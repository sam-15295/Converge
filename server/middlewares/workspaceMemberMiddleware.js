import mongoose from "mongoose";
import WorkspaceMember from "../model/workspaceMemberSchema.js";

// WORKSPACE ISOLATION : runs on every route that has :workspaceId in the URL.
// It asks the database "is this logged in user a member of this workspace?" and never trusts
// anything the frontend says about membership or role. On success req.membership holds the
// user's membership (workspaceId, userId, role) and the controllers read the role from it.
//
// Not a member gets 404, not 403. A 403 would tell an outsider "this workspace exists", so
// a guessed id (IDOR attack) reveals nothing. A malformed id is treated the same way.
const workspaceMemberMiddleware = async (req, res, next)=>{
    try{
        const {workspaceId} = req.params;

        if(!mongoose.isValidObjectId(workspaceId)){
            return res.status(404).json({
                message : "Workspace not found"
            });
        }

        const membership = await WorkspaceMember.findOne({
            workspaceId,
            userId : req.user._id
        });

        if(!membership){
            return res.status(404).json({
                message : "Workspace not found"
            });
        }

        req.membership = membership;
        next();
    }
    catch(err){
        console.log(err);
        res.status(500).json({message : "Internal Server Error"});
    }
}

export default workspaceMemberMiddleware;
