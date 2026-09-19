import mongoose from "mongoose";

// "Something happened that you should know about". It POINTS at what happened (sourceType + sourceId) instead of
// storing display text, so the inbox always shows the current message and can link to it.
// Today the only kind is MENTION (somebody mentioned you in a chat message). Comments, replies and invitations add
// their own types and source types in later phases.
const notificationSchema = new mongoose.Schema({
    // who is notified
    recipientId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },

    type : {
        type : String,
        enum : ["MENTION"],
        required : true
    },

    // what the notification points at, and its id
    sourceType : {
        type : String,
        enum : ["MESSAGE"],
        required : true
    },

    sourceId : {
        type : mongoose.Schema.Types.ObjectId,
        required : true
    },

    // the workspace it happened in. Everything the recipient may see is limited to workspaces they are STILL a member of.
    workspaceId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Workspace",
        required : true
    },

    // who caused it
    senderId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },

    read : {
        type : Boolean,
        default : false
    },

    readAt : {
        type : Date,
        default : null
    }
}, {timestamps : true});

// "my notifications, newest first" (the inbox pages with a cursor, like the chat history : _id is the tie breaker)
notificationSchema.index({recipientId : 1, createdAt : -1, _id : -1});

// "how many are unread" and "only the unread ones"
notificationSchema.index({recipientId : 1, read : 1, createdAt : -1});

// One notification per person per source : the same mention can never notify twice, even if the event arrives twice
notificationSchema.index({recipientId : 1, type : 1, sourceType : 1, sourceId : 1}, {unique : true});

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
