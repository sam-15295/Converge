import mongoose from "mongoose";
import Message from "../model/messageSchema.js";
import appEvents from "../events/appEvents.js";
import {reactionParamsSchema} from "../validators/messageValidator.js";
import {loadAndFormat} from "../service/messageService.js";

// A reaction is stored as   reactions : { "👍" : [userId, userId], ... }
// Both changes are ONE atomic database operation on ONE message, so many people reacting at the same moment
// cannot overwrite each other :
//   $addToSet  adds the user to that emoji's list, unless already there (so clicking twice does not count twice)
//   $pull      removes the user from it
// The emoji comes from a fixed list (config/reactions.js), so it is never arbitrary text in a field name.

const reactionPath = (emoji)=> `reactions.${emoji}`;

// Reads and checks :messageId and :emoji. Returns null (after answering) when something is wrong.
const readParams = (req, res)=>{
    const result = reactionParamsSchema.safeParse({emoji : req.params.emoji});

    if(!result.success){
        res.status(400).json({
            message : result.error.issues[0].message
        });
        return null;
    }

    if(!mongoose.isValidObjectId(req.params.messageId)){
        res.status(404).json({
            message : "Message not found"
        });
        return null;
    }

    return {emoji : result.data.emoji, messageId : req.params.messageId};
}

const changeReaction = async (req, res, makeUpdate, doneMessage, tidyUp)=>{
    try{
        const params = readParams(req, res);

        if(!params){
            return;
        }

        const {emoji, messageId} = params;
        const workspaceId = req.membership.workspaceId;

        // looked up inside the workspace of the URL : a message of another workspace is simply "not found"
        // returnDocument "after" : the answer holds the reactions as they are NOW, including this change
        const updated = await Message.findOneAndUpdate({_id : messageId, workspaceId}, makeUpdate(emoji, req.user._id), {returnDocument : "after"});

        if(!updated){
            return res.status(404).json({
                message : "Message not found"
            });
        }

        // done BEFORE answering, so nobody can read the message between the change and the tidy-up
        if(tidyUp){
            await tidyUp(messageId, emoji);
        }

        const chatMessage = await loadAndFormat(updated);
        appEvents.emit("message:updated", {workspaceId, chatMessage});

        res.status(200).json({
            message : doneMessage,
            chatMessage
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const addReaction = (req, res)=>{
    return changeReaction(req, res, (emoji, userId)=> ({$addToSet : {[reactionPath(emoji)] : userId}}), "Reaction added");
}

// an emoji nobody uses any more is removed from the message (it would be hidden anyway)
const removeEmptyList = (messageId, emoji)=>{
    return Message.updateOne({_id : messageId, [reactionPath(emoji)] : {$size : 0}}, {$unset : {[reactionPath(emoji)] : ""}});
}

export const removeReaction = (req, res)=>{
    return changeReaction(req, res, (emoji, userId)=> ({$pull : {[reactionPath(emoji)] : userId}}), "Reaction removed", removeEmptyList);
}
