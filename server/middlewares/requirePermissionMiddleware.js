import {can} from "../config/permissions.js";

// AUTHORIZATION ("what may you do?"). Runs after workspaceMemberMiddleware, which is what
// puts the user's role in req.membership.
//     router.patch("/:workspaceId", requirePermissionMiddleware("workspace:update"), updateWorkspace);
// The user is already known to be a member here, so a refusal is a real 403.
const requirePermissionMiddleware = (permission)=>{
    return (req, res, next)=>{
        if(!can(req.membership.role, permission)){
            return res.status(403).json({
                message : "You are not allowed to do this"
            });
        }

        next();
    }
}

export default requirePermissionMiddleware;
