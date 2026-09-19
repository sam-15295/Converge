import Workspace from "../model/workspaceSchema.js";
import WorkspaceMember from "../model/workspaceMemberSchema.js";
import WorkspaceInvite from "../model/workspaceInviteSchema.js";
import Document from "../model/documentSchema.js";
import Message from "../model/messageSchema.js";
import appEvents from "../events/appEvents.js";
import {permissionsOf, rolesBelow} from "../config/permissions.js";
import {createWorkspaceSchema, updateWorkspaceSchema} from "../validators/workspaceValidator.js";
import formatZodErrors from "../validators/formatZodErrors.js";

// only these fields are ever sent to the client
const formatWorkspace = (workspace)=>{
    return {
        id : workspace._id,
        name : workspace.name,
        description : workspace.description,
        createdAt : workspace.createdAt
    };
}

export const createWorkspace = async (req, res)=>{
    try{
        const result = createWorkspaceSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const {name, description} = result.data;

        const workspace = await Workspace.create({
            name,
            description,
            createdBy : req.user._id
        });

        // the creator becomes the OWNER
        try{
            await WorkspaceMember.create({
                workspaceId : workspace._id,
                userId : req.user._id,
                role : "OWNER"
            });
        }
        catch(err){
            // Without the owner membership nobody could ever open this workspace, so remove it.
            // (Doing both writes as one all-or-nothing step needs a MongoDB transaction, which
            // needs a replica set. This clean-up is the simple alternative.)
            await Workspace.deleteOne({_id : workspace._id});
            throw err;
        }

        res.status(201).json({
            message : "Workspace created Successfully",
            workspace : formatWorkspace(workspace),
            role : "OWNER"
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

// only the workspaces the user belongs to, each with the user's own role in it
export const getMyWorkspaces = async (req, res)=>{
    try{
        const memberships = await WorkspaceMember.find({userId : req.user._id})
        .populate("workspaceId", "name description createdAt")
        .sort({createdAt : -1});

        const workspaces = memberships
        .filter((membership)=> membership.workspaceId)      // skip a membership whose workspace no longer exists
        .map((membership)=> ({
            ...formatWorkspace(membership.workspaceId),
            role : membership.role
        }));

        res.status(200).json({
            message : "Your workspaces",
            workspaces
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const getWorkspace = async (req, res)=>{
    try{
        const workspace = await Workspace.findById(req.membership.workspaceId);

        if(!workspace){
            return res.status(404).json({
                message : "Workspace not found"
            });
        }

        res.status(200).json({
            message : "Your workspace",
            workspace : formatWorkspace(workspace),
            role : req.membership.role,
            permissions : permissionsOf(req.membership.role),
            assignableRoles : rolesBelow(req.membership.role)
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const updateWorkspace = async (req, res)=>{
    try{
        const result = updateWorkspaceSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const workspace = await Workspace.findById(req.membership.workspaceId);

        if(!workspace){
            return res.status(404).json({
                message : "Workspace not found"
            });
        }

        const {name, description} = result.data;

        if(name !== undefined){
            workspace.name = name;
        }
        if(description !== undefined){
            workspace.description = description;
        }

        await workspace.save();

        res.status(200).json({
            message : "Workspace updated Successfully",
            workspace : formatWorkspace(workspace)
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const deleteWorkspace = async (req, res)=>{
    try{
        const {workspaceId} = req.membership;

        // Members are removed FIRST : from that moment nobody can open the workspace any more
        // (workspaceMemberMiddleware finds no membership), even if a later step fails.
        // Later phases add their own data here (comments...).
        await WorkspaceMember.deleteMany({workspaceId});
        await WorkspaceInvite.deleteMany({workspaceId});
        await Document.deleteMany({workspaceId});
        await Message.deleteMany({workspaceId});
        await Workspace.deleteOne({_id : workspaceId});

        // people who have one of its documents open are sent away (the socket layer listens)
        appEvents.emit("workspace:deleted", {workspaceId});

        res.status(200).json({
            message : "Workspace deleted Successfully"
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}
