import mongoose from "mongoose";
import mentionsField from "./mentionsField.js";

// A comment on a document. Comments belong to the DOCUMENT as a whole (they are not tied to a piece of its text).
// A thread is one top-level comment (parentCommentId null) and its replies (parentCommentId = that comment).
// Like in the chat there is ONE level : a reply cannot be answered, you answer the thread.
const commentSchema = new mongoose.Schema({
    workspaceId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Workspace",
        required : true
    },

    documentId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Document",
        required : true
    },

    authorId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },

    // plain text, never HTML. It is shown as text, so it cannot run anything.
    content : {
        type : String,
        required : true,
        maxlength : 2000
    },

    // null = starts a thread. Otherwise the id of the comment this one replies to (which is itself not a reply).
    parentCommentId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Comment",
        default : null
    },

    mentions : mentionsField,

    // Only the FIRST comment of a thread is resolved or reopened (which resolves the whole thread).
    resolved : {
        type : Boolean,
        default : false
    },

    resolvedBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        default : null
    },

    resolvedAt : {
        type : Date,
        default : null
    }
}, {timestamps : true});

// "the threads of this document, open or resolved, newest first" (the panel pages with a cursor : _id is the tie breaker)
commentSchema.index({documentId : 1, parentCommentId : 1, resolved : 1, createdAt : -1, _id : -1});

// "the replies of these threads, oldest first"
commentSchema.index({parentCommentId : 1, createdAt : 1, _id : 1});

// clean-up when a workspace is deleted
commentSchema.index({workspaceId : 1});

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
