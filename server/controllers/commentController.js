import mongoose from "mongoose";
import Comment from "../model/commentSchema.js";
import appEvents from "../events/appEvents.js";
import {createCommentSchema, listCommentsQuerySchema} from "../validators/commentValidator.js";
import formatZodErrors from "../validators/formatZodErrors.js";
import {resolveMentions} from "../service/mentionService.js";
import {countOpenThreads, findThread, findThreads, loadAndFormat} from "../service/commentService.js";

// Everything about a comment is looked up INSIDE the document of the URL (which commentDocumentMiddleware already checked
// to be a document of this workspace), so a comment id of another document is "not found".

const maxRepliesPerThread = 200;      // a thread is sent whole with every page, so it may not grow without limit

export const listComments = async (req, res)=>{
    try{
        const result = listCommentsQuerySchema.safeParse(req.query);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const {status, limit, before} = result.data;
        const page = await findThreads({documentId : req.document._id, status, before, limit});

        if(!page){
            return res.status(404).json({
                message : "Comment not found"
            });
        }

        res.status(200).json({
            message : "Comments",
            threads : page.threads,
            hasMore : page.hasMore,
            openCount : await countOpenThreads(req.document._id)
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

// One thread by the id of its first comment (a link from a notification points at it)
export const getThread = async (req, res)=>{
    try{
        const {commentId} = req.params;
        const thread = mongoose.isValidObjectId(commentId) ? await findThread(req.document._id, commentId) : null;

        if(!thread){
            return res.status(404).json({
                message : "Comment not found"
            });
        }

        res.status(200).json({
            message : "Comment thread",
            thread
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const createComment = async (req, res)=>{
    try{
        const result = createCommentSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const {content, parentCommentId, mentions : requestedMentions} = result.data;
        const {workspaceId, _id : documentId} = req.document;

        // a reply must answer the FIRST comment of a thread of this document, and only ONE level of replies is allowed
        let parent = null;

        if(parentCommentId){
            parent = await Comment.findOne({_id : parentCommentId, documentId});

            if(!parent){
                return res.status(404).json({
                    message : "The comment you are replying to was not found"
                });
            }
            if(parent.parentCommentId){
                return res.status(400).json({
                    message : "You can only reply to the first comment of a thread, not to another reply"
                });
            }
            if(parent.resolved){
                return res.status(409).json({
                    message : "This thread is resolved. Reopen it to reply."
                });
            }
            if(await Comment.countDocuments({parentCommentId : parent._id}) >= maxRepliesPerThread){
                return res.status(409).json({
                    message : "This thread is full"
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

        // the author comes from the login, the workspace and the document from the URL, never from the body
        const created = await Comment.create({
            workspaceId,
            documentId,
            authorId : req.user._id,
            content,
            mentions,
            parentCommentId : parent ? parent._id : null
        });

        const comment = await loadAndFormat(created);

        // Say WHAT happened. The socket layer pushes it to everybody who has the comments of this document open.
        appEvents.emit("comment:created", {workspaceId, documentId, comment});

        // one event per mentioned person : this is what notifications react to (the same event as a chat mention)
        for(const mention of mentions){
            appEvents.emit("mention:created", {
                workspaceId,
                recipientId : mention.userId,
                senderId : req.user._id,
                sourceType : "COMMENT",
                sourceId : created._id
            });
        }

        res.status(201).json({
            message : "Comment added Successfully",
            comment
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}
