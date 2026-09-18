import mongoose from "mongoose";
import {assignableRoles} from "../config/permissions.js";

// A pending invitation. It is tied to an EMAIL ADDRESS (not a user id), so someone who has not
// signed up yet can be invited : the invite waits, and shows up once they log in with that email.
// Accepting turns it into a WorkspaceMember and deletes it, declining or revoking just deletes it.
const workspaceInviteSchema = new mongoose.Schema({
    workspaceId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Workspace",
        required : true
    },

    email : {
        type : String,
        required : true,
        lowercase : true,
        trim : true
    },

    // the role the person gets when they accept (never OWNER)
    role : {
        type : String,
        enum : assignableRoles,
        required : true
    },

    invitedBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    }
}, {timestamps : true});

// one pending invite per person per workspace
workspaceInviteSchema.index({workspaceId : 1, email : 1}, {unique : true});

// "which invites are waiting for me?"
workspaceInviteSchema.index({email : 1});

const WorkspaceInvite = mongoose.model("WorkspaceInvite", workspaceInviteSchema);

export default WorkspaceInvite;
