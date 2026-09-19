import mongoose from "mongoose";

// One meaningful thing that happened in a workspace : "Amit created Graphs", "Priya edited DP Notes".
//
// Like a notification, an activity POINTS AT its source (ids) instead of storing a sentence. The names and titles are
// looked up when the feed is shown, so a renamed document reads correctly in old entries too.
//
// Only events worth reading are recorded. Typing is not an event : a document becomes "edited" once its editing
// session produced a version, so a whole afternoon of writing is one line in the feed, not thousands.
export const activityTypes = [
    "DOCUMENT_CREATED",
    "DOCUMENT_EDITED",
    "DOCUMENT_RESTORED",
    "COMMENT_ADDED",
    "MEMBER_JOINED",
    "MENTIONED"
];

const activitySchema = new mongoose.Schema({
    workspaceId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Workspace",
        required : true
    },

    // who did it
    actorId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },

    type : {
        type : String,
        enum : activityTypes,
        required : true
    },

    // what it happened to : a document for the document and comment entries, nothing for the rest
    documentId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Document",
        default : null
    },

    // the other person, when the entry is about one (MENTIONED)
    subjectId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        default : null
    }
}, {timestamps : true});

// the only query the feed makes : "what happened in this workspace, newest first" (paged with a cursor)
activitySchema.index({workspaceId : 1, createdAt : -1, _id : -1});

// clean-up when a document is deleted
activitySchema.index({documentId : 1});

const Activity = mongoose.model("Activity", activitySchema);

export default Activity;
