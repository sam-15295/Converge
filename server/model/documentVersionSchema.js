import mongoose from "mongoose";

// One saved point in the history of a document.
//
// A version is NOT written per keystroke. The live room (service/docRoomService.js) collects the edits of an
// "editing session" and writes ONE version when that session ends, at most every few minutes. See service/versionService.js.
//
// Only the Yjs state is stored, not a second JSON copy : the readable tree is worked out from the state when somebody
// actually looks at a version. That halves the storage and, more importantly, the two can never disagree.
const documentVersionSchema = new mongoose.Schema({
    documentId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Document",
        required : true
    },

    // kept here too, so the clean-up when a workspace is deleted is one query
    workspaceId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Workspace",
        required : true
    },

    // The whole document as a Yjs state, exactly as documentSchema stores the current one.
    // Hidden from normal queries, because it is large : ask for it with .select("+yjsState").
    yjsState : {
        type : Buffer,
        select : false,
        required : true
    },

    // the title the document had at that moment, so the history also shows renames
    title : {
        type : String,
        required : true,
        maxlength : 100
    },

    // everybody who edited between the previous version and this one (not only the last person)
    authors : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "User"
    }],

    // AUTOSAVE : an editing session ended.  RESTORE : somebody put an older version back.
    reason : {
        type : String,
        enum : ["AUTOSAVE", "RESTORE"],
        default : "AUTOSAVE"
    },

    // who pressed restore (only for RESTORE)
    createdBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        default : null
    },

    // which version was put back (only for RESTORE), so the history explains itself
    restoredFromId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "DocumentVersion",
        default : null
    },

    // the size of yjsState, kept so the list can show it without loading the state itself
    byteSize : {
        type : Number,
        required : true
    }
}, {timestamps : true});

// "the versions of this document, newest first" (the panel pages with a cursor : _id is the tie breaker)
documentVersionSchema.index({documentId : 1, createdAt : -1, _id : -1});

// clean-up when a workspace is deleted
documentVersionSchema.index({workspaceId : 1});

const DocumentVersion = mongoose.model("DocumentVersion", documentVersionSchema);

export default DocumentVersion;
