import mongoose from "mongoose";

// A document of a workspace. Only the current state is stored here (version history comes in a later phase).
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

    // The shared document as a Yjs state (binary). This is the SOURCE OF TRUTH : the editor edits a Yjs
    // document live, and the server saves its whole state here (see service/docRoomService.js).
    // Hidden from normal queries, because it is large : ask for it with .select("+yjsState").
    yjsState : {
        type : Buffer,
        select : false
    },

    // A readable snapshot of the same document as a JSON tree (TipTap / ProseMirror), for example
    //   { type : "doc", content : [ { type : "paragraph", content : [ { type : "text", text : "Hello" } ] } ] }
    // Written together with yjsState. Later phases use it for version history and search.
    // Documents written before Phase 5 only have this field, and get their Yjs state the first time they are opened.
    content : {
        type : mongoose.Schema.Types.Mixed,
        select : false,
        default : ()=> ({type : "doc", content : [{type : "paragraph"}]})
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
