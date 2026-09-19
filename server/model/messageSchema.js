import mongoose from "mongoose";

// One chat message of a workspace. A reply (a message in a thread) is also a Message : it just points at its parent.
const messageSchema = new mongoose.Schema({
    workspaceId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Workspace",
        required : true
    },

    senderId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },

    // plain text, never HTML. It is shown as text, so it cannot run anything.
    content : {
        type : String,
        required : true,
        maxlength : 4000
    },

    // null = a normal message of the chat. Otherwise the id of the message this one replies to.
    // A thread has ONE level : you can only reply to a message that is not itself a reply.
    parentMessageId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Message",
        default : null
    },

    // kept on the PARENT so the chat list can show "3 replies" without counting on every read
    replyCount : {
        type : Number,
        default : 0
    },

    lastReplyAt : {
        type : Date,
        default : null
    },

    // { "👍" : [userId, userId], "🎉" : [userId] }   (emoji from config/reactions.js)
    // Changed only with atomic operators ($addToSet / $pull), so two people reacting at the same moment cannot lose each other's reaction.
    reactions : {
        type : mongoose.Schema.Types.Mixed,
        default : ()=> ({})
    }
}, {timestamps : true, minimize : false});

// The most common query : "the latest messages of this workspace" (parentMessageId null), and "the replies of this message".
// _id is the tie breaker for messages created in the same millisecond, so paging never skips or repeats one.
messageSchema.index({workspaceId : 1, parentMessageId : 1, createdAt : -1, _id : -1});

const Message = mongoose.model("Message", messageSchema);

export default Message;
