import mongoose from "mongoose";
import WorkspaceMember from "../model/workspaceMemberSchema.js";
import {roles, outranks} from "../config/permissions.js";
import {changeRoleSchema} from "../validators/workspaceValidator.js";
import formatZodErrors from "../validators/formatZodErrors.js";

// only these fields are ever sent to the client
const formatMember = (membership)=>{
    return {
        userId : membership.userId._id,
        name : membership.userId.name,
        email : membership.userId.email,
        role : membership.role,
        joinedAt : membership.createdAt
    };
}

// The member the request is about (the :userId in the URL), always looked up INSIDE the workspace
// of the URL, so a user id from another workspace can never be reached through this one.
const findTargetMembership = async (req)=>{
    const {userId} = req.params;

    if(!mongoose.isValidObjectId(userId)){
        return null;
    }

    return WorkspaceMember.findOne({
        workspaceId : req.membership.workspaceId,
        userId
    });
}

const sameUser = (membership, user)=>{
    return String(membership.userId) === String(user._id);
}

export const listMembers = async (req, res)=>{
    try{
        const memberships = await WorkspaceMember.find({workspaceId : req.membership.workspaceId})
        .populate("userId", "name email")
        .sort({createdAt : 1});

        // strongest role first (roles is ordered OWNER, ADMIN, MEMBER, VIEWER), then the ones who joined earlier
        const members = memberships
        .filter((membership)=> membership.userId)
        .map(formatMember)
        .sort((a, b)=> roles.indexOf(a.role) - roles.indexOf(b.role));

        res.status(200).json({
            message : "Workspace members",
            members
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const changeMemberRole = async (req, res)=>{
    try{
        const result = changeRoleSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const target = await findTargetMembership(req);

        if(!target){
            return res.status(404).json({
                message : "Member not found"
            });
        }

        const newRole = result.data.role;
        const myRole = req.membership.role;

        if(sameUser(target, req.user)){
            return res.status(400).json({
                message : "You cannot change your own role"
            });
        }

        // you can only manage people who rank below you (nobody can touch the OWNER)
        if(!outranks(myRole, target.role)){
            return res.status(403).json({
                message : "You cannot change the role of someone who ranks equal to or above you"
            });
        }

        // and you cannot hand out a role equal to or above your own
        if(!outranks(myRole, newRole)){
            return res.status(403).json({
                message : "You cannot give a role equal to or above your own"
            });
        }

        target.role = newRole;
        await target.save();

        res.status(200).json({
            message : "Member role updated Successfully",
            member : {userId : target.userId, role : target.role}
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const removeMember = async (req, res)=>{
    try{
        const target = await findTargetMembership(req);

        if(!target){
            return res.status(404).json({
                message : "Member not found"
            });
        }

        if(sameUser(target, req.user)){
            return res.status(400).json({
                message : "You cannot remove yourself, use leave instead"
            });
        }

        if(!outranks(req.membership.role, target.role)){
            return res.status(403).json({
                message : "You cannot remove someone who ranks equal to or above you"
            });
        }

        await target.deleteOne();

        res.status(200).json({
            message : "Member removed Successfully"
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const leaveWorkspace = async (req, res)=>{
    try{
        // Someone has to own the workspace. (Handing ownership to another member is a later improvement.)
        if(req.membership.role === "OWNER"){
            return res.status(403).json({
                message : "The owner cannot leave the workspace, delete it instead"
            });
        }

        await req.membership.deleteOne();

        res.status(200).json({
            message : "You left the workspace"
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}
