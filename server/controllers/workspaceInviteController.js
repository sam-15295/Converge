import mongoose from "mongoose";
import User from "../model/userSchema.js";
import Workspace from "../model/workspaceSchema.js";
import WorkspaceMember from "../model/workspaceMemberSchema.js";
import WorkspaceInvite from "../model/workspaceInviteSchema.js";
import {outranks} from "../config/permissions.js";
import {inviteSchema} from "../validators/workspaceValidator.js";
import formatZodErrors from "../validators/formatZodErrors.js";
import appEvents from "../events/appEvents.js";

const mongoDuplicateKey = 11000;

// what an ADMIN or OWNER sees about an invite of their workspace
const formatInvite = (invite)=>{
    return {
        id : invite._id,
        email : invite.email,
        role : invite.role,
        invitedBy : invite.invitedBy?.name,
        createdAt : invite.createdAt
    };
}

// ---------- the workspace side (OWNER and ADMIN) ----------

export const createInvite = async (req, res)=>{
    try{
        const result = inviteSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const {email, role} = result.data;

        // you can only invite people to a role below your own (an ADMIN cannot invite another ADMIN)
        if(!outranks(req.membership.role, role)){
            return res.status(403).json({
                message : "You cannot invite someone to a role equal to or above your own"
            });
        }

        // Already a member? Only the membership is checked, so this never reveals whether
        // an email has an account (the member list already shows who is inside).
        const existingUser = await User.findOne({email});

        if(existingUser){
            const alreadyMember = await WorkspaceMember.exists({
                workspaceId : req.membership.workspaceId,
                userId : existingUser._id
            });

            if(alreadyMember){
                return res.status(409).json({
                    message : "This person is already a member"
                });
            }
        }

        let invite;

        try{
            invite = await WorkspaceInvite.create({
                workspaceId : req.membership.workspaceId,
                email,
                role,
                invitedBy : req.user._id
            });
        }
        catch(err){
            // the unique index {workspaceId, email} decides, even when two invites arrive at the same moment
            if(err.code === mongoDuplicateKey){
                return res.status(409).json({
                    message : "This email is already invited"
                });
            }
            throw err;
        }

        invite.invitedBy = req.user;    // so formatInvite can show the name

        res.status(201).json({
            message : "Invitation created Successfully",
            invite : formatInvite(invite)
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const listWorkspaceInvites = async (req, res)=>{
    try{
        const invites = await WorkspaceInvite.find({workspaceId : req.membership.workspaceId})
        .populate("invitedBy", "name")
        .sort({createdAt : -1});

        res.status(200).json({
            message : "Pending invitations",
            invites : invites.map(formatInvite)
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const revokeInvite = async (req, res)=>{
    try{
        const {inviteId} = req.params;

        if(!mongoose.isValidObjectId(inviteId)){
            return res.status(404).json({
                message : "Invitation not found"
            });
        }

        // looked up INSIDE this workspace, so an invite id of another workspace cannot be reached
        const invite = await WorkspaceInvite.findOne({
            _id : inviteId,
            workspaceId : req.membership.workspaceId
        });

        if(!invite){
            return res.status(404).json({
                message : "Invitation not found"
            });
        }

        // same rank rule as everywhere : an ADMIN cannot cancel an invitation to ADMIN
        if(!outranks(req.membership.role, invite.role)){
            return res.status(403).json({
                message : "You cannot cancel an invitation to a role equal to or above your own"
            });
        }

        await invite.deleteOne();

        res.status(200).json({
            message : "Invitation cancelled Successfully"
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

// ---------- the invited person's side (any logged in user, about THEIR OWN invitations) ----------

export const getMyInvites = async (req, res)=>{
    try{
        const invites = await WorkspaceInvite.find({email : req.user.email})
        .populate("workspaceId", "name description")
        .populate("invitedBy", "name")
        .sort({createdAt : -1});

        res.status(200).json({
            message : "Your invitations",
            invites : invites
            .filter((invite)=> invite.workspaceId)
            .map((invite)=> ({
                id : invite._id,
                role : invite.role,
                workspace : {id : invite.workspaceId._id, name : invite.workspaceId.name, description : invite.workspaceId.description},
                invitedBy : invite.invitedBy?.name,
                createdAt : invite.createdAt
            }))
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

// Finds an invitation ONLY if it is addressed to the logged in user's email.
// Someone else's invitation gives the same "not found" as an id that does not exist.
const findMyInvite = async (req)=>{
    const {inviteId} = req.params;

    if(!mongoose.isValidObjectId(inviteId)){
        return null;
    }

    return WorkspaceInvite.findOne({_id : inviteId, email : req.user.email});
}

export const acceptInvite = async (req, res)=>{
    try{
        const invite = await findMyInvite(req);

        if(!invite){
            return res.status(404).json({
                message : "Invitation not found"
            });
        }

        const workspace = await Workspace.findById(invite.workspaceId);

        if(!workspace){
            await invite.deleteOne();   // the workspace was deleted meanwhile
            return res.status(404).json({
                message : "Invitation not found"
            });
        }

        // The unique index {workspaceId, userId} makes sure nobody joins twice,
        // even if "accept" is sent twice at the same moment.
        try{
            await WorkspaceMember.create({
                workspaceId : invite.workspaceId,
                userId : req.user._id,
                role : invite.role
            });
        }
        catch(err){
            if(err.code === mongoDuplicateKey){
                await invite.deleteOne();
                return res.status(409).json({
                    message : "You are already a member of this workspace"
                });
            }
            throw err;
        }

        await invite.deleteOne();

        // one line in the workspace activity feed
        appEvents.emit("member:joined", {
            workspaceId : String(invite.workspaceId),
            userId : String(req.user._id)
        });

        res.status(200).json({
            message : "Invitation accepted Successfully",
            workspace : {id : workspace._id, name : workspace.name, description : workspace.description},
            role : invite.role
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const declineInvite = async (req, res)=>{
    try{
        const invite = await findMyInvite(req);

        if(!invite){
            return res.status(404).json({
                message : "Invitation not found"
            });
        }

        await invite.deleteOne();

        res.status(200).json({
            message : "Invitation declined"
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}
