import mongoose from "mongoose";
import Message from "../model/messageSchema.js";
import appEvents from "../events/appEvents.js";
import {sendMessageSchema, listMessagesQuerySchema} from "../validators/messageValidator.js";
import formatZodErrors from "../validators/formatZodErrors.js";
import {findPage, formatMessage, loadAndFormat} from "../service/messageService.js";
import {resolveMentions} from "../service/mentionService.js";

// Everything about a chat message is looked up INSIDE the workspace of the URL, so an id from another workspace is "not found".

export const sendMessage = async (req, res)=>{
    try{
        const result = sendMessageSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const {content, parentMessageId, mentions : requestedMentions} = result.data;
        const workspaceId = req.membership.workspaceId;

        // a reply must point at a message of this chat, and only ONE level of replies is allowed
        let parent = null;

        if(parentMessageId){
            parent = await Message.findOne({_id : parentMessageId, workspaceId});

            if(!parent){
                return res.status(404).json({
                    message : "The message you are replying to was not found"
                });
            }
            if(parent.parentMessageId){
                return res.status(400).json({
                    message : "You can only reply to a message of the chat, not to another reply"
                });
            }
        }

        // who is mentioned : members of THIS workspace only, named by our data, and really written in the text
        const {mentions, problem} = await resolveMentions(workspaceId, content, requestedMentions);

        if(problem){
            return res.status(400).json({
                message : problem
            });
        }

        // the sender comes from the login and the workspace from the URL, never from the body
        const created = await Message.create({
            workspaceId,
            senderId : req.user._id,
            content,
            mentions,
            parentMessageId : parent ? parent._id : null
        });

        const chatMessage = await loadAndFormat(created);
        let updatedParent = null;

        if(parent){
            // atomic : two replies at the same moment both count. $max keeps the LATEST reply time even if they finish out of order.
            const updated = await Message.findByIdAndUpdate(
                parent._id,
                {$inc : {replyCount : 1}, $max : {lastReplyAt : created.createdAt}},
                {returnDocument : "after"}       // give back the updated message, not the one from before
            );
            updatedParent = await loadAndFormat(updated);
        }

        // Say WHAT happened. The socket layer listens and pushes it to everybody who has this chat open.
        appEvents.emit("message:created", {workspaceId, chatMessage});
        if(updatedParent){
            appEvents.emit("message:updated", {workspaceId, chatMessage : updatedParent});
        }

        // one event per mentioned person : this is what the notifications (a later phase) will react to
        for(const mention of mentions){
            appEvents.emit("mention:created", {
                workspaceId,
                recipientId : mention.userId,
                senderId : req.user._id,
                sourceType : "MESSAGE",
                sourceId : created._id
            });
        }

        res.status(201).json({
            message : "Message sent Successfully",
            chatMessage,
            parent : updatedParent
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

const readPage = async (req, res, parentMessageId)=>{
    const result = listMessagesQuerySchema.safeParse(req.query);

    if(!result.success){
        return res.status(400).json({
            message : result.error.issues[0].message,
            errors : formatZodErrors(result.error)
        });
    }

    const {limit, before, after, around} = result.data;
    const page = await findPage({workspaceId : req.membership.workspaceId, parentMessageId, before, after, around, limit});

    if(!page){
        return res.status(404).json({
            message : "Message not found"
        });
    }

    res.status(200).json({
        message : "Chat messages",
        messages : page.messages.map(formatMessage),

        // a window has two sides, a normal page one
        ...(around ? {hasMoreOlder : page.hasMoreOlder, hasMoreNewer : page.hasMoreNewer} : {hasMore : page.hasMore})
    });
}

// The main chat : the latest messages, or a page before / after a given message, or a window around one.
export const listMessages = async (req, res)=>{
    try{
        await readPage(req, res, null);
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

// The replies of one message (its thread)
export const listReplies = async (req, res)=>{
    try{
        const {messageId} = req.params;

        if(!mongoose.isValidObjectId(messageId)){
            return res.status(404).json({
                message : "Message not found"
            });
        }

        // only a message of the main chat can have replies
        const parent = await Message.exists({_id : messageId, workspaceId : req.membership.workspaceId, parentMessageId : null});

        if(!parent){
            return res.status(404).json({
                message : "Message not found"
            });
        }

        await readPage(req, res, parent._id);
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}
