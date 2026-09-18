import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema({
    name : {
        type : String,
        required : true,
        trim : true,
        maxlength : 50
    },

    description : {
        type : String,
        trim : true,
        maxlength : 200,
        default : ""
    },

    // who created it. The role of every person (including the owner) is kept in WorkspaceMember.
    createdBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    }
}, {timestamps : true});

const Workspace = mongoose.model("Workspace", workspaceSchema);

export default Workspace;
