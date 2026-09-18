import mongoose from "mongoose";
import {roles} from "../config/permissions.js";

// One document = "this user belongs to this workspace with this role".
// Membership is its own collection (not an array inside Workspace or User) because it is a
// relationship with its own data (the role), and because it is queried from both sides :
// "who is in this workspace?" and "which workspaces am I in?".
const workspaceMemberSchema = new mongoose.Schema({
    workspaceId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Workspace",
        required : true
    },

    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },

    role : {
        type : String,
        enum : roles,
        required : true
    }
}, {timestamps : true});

// a user can be in a workspace only once (the database enforces it, even for two requests at the same moment)
workspaceMemberSchema.index({workspaceId : 1, userId : 1}, {unique : true});

// "which workspaces am I in?"
workspaceMemberSchema.index({userId : 1});

const WorkspaceMember = mongoose.model("WorkspaceMember", workspaceMemberSchema);

export default WorkspaceMember;
