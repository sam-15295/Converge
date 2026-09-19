import mongoose from "mongoose";

// A document of a workspace. Only the current state is stored here.
// (Snapshots and version history come in a later phase, and real-time editing with Yjs in Phase 5.)
const documentSchema = new mongoose.Schema({
    workspaceId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Workspace",
        required : true
    },

    title : {
        type : String,
        required : true,
        trim : true,
        maxlength : 100
    },

    // The editor's document as a JSON tree (TipTap / ProseMirror), for example
    //   { type : "doc", content : [ { type : "paragraph", content : [ { type : "text", text : "Hello" } ] } ] }
    // It can be large, so it is left out of normal queries : ask for it with .select("+content").
    // The server checks the tree against a whitelist before saving (validators/documentContentValidator.js).
    content : {
        type : mongoose.Schema.Types.Mixed,
        select : false,
        default : ()=> ({type : "doc", content : [{type : "paragraph"}]})
    },

    // Goes up by one on every content save. A save must say which version it is based on,
    // and only succeeds if that is still the current one (optimistic locking).
    version : {
        type : Number,
        default : 0
    },

    createdBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },

    lastEditedBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User"
    }
}, {timestamps : true, minimize : false});   // minimize false : keep empty objects inside the content

// the most common query : "the documents of this workspace, most recently changed first"
documentSchema.index({workspaceId : 1, updatedAt : -1});

const Document = mongoose.model("Document", documentSchema);

export default Document;
