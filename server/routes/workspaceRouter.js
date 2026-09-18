import express from "express";
import {createWorkspace, getMyWorkspaces, getWorkspace, updateWorkspace, deleteWorkspace} from "../controllers/workspaceController.js";
import {listMembers, changeMemberRole, removeMember, leaveWorkspace} from "../controllers/workspaceMemberController.js";
import {createInvite, listWorkspaceInvites, revokeInvite} from "../controllers/workspaceInviteController.js";
import authUserMiddleware from "../middlewares/authUserMiddleware.js";
import workspaceMemberMiddleware from "../middlewares/workspaceMemberMiddleware.js";
import requirePermissionMiddleware from "../middlewares/requirePermissionMiddleware.js";

const workspaceRouter = express.Router();

// everything here needs a logged in user
workspaceRouter.use(authUserMiddleware);

workspaceRouter.post("/", createWorkspace);
workspaceRouter.get("/", getMyWorkspaces);

// Everything below has :workspaceId in the URL, so first check that the user is a member of it.
// Then each route also checks the permission its action needs (see config/permissions.js).
workspaceRouter.use("/:workspaceId", workspaceMemberMiddleware);

workspaceRouter.get("/:workspaceId", requirePermissionMiddleware("workspace:view"), getWorkspace);
workspaceRouter.patch("/:workspaceId", requirePermissionMiddleware("workspace:update"), updateWorkspace);
workspaceRouter.delete("/:workspaceId", requirePermissionMiddleware("workspace:delete"), deleteWorkspace);

workspaceRouter.get("/:workspaceId/members", requirePermissionMiddleware("member:view"), listMembers);
workspaceRouter.patch("/:workspaceId/members/:userId", requirePermissionMiddleware("member:changeRole"), changeMemberRole);
workspaceRouter.delete("/:workspaceId/members/:userId", requirePermissionMiddleware("member:remove"), removeMember);

workspaceRouter.post("/:workspaceId/invites", requirePermissionMiddleware("invite:create"), createInvite);
workspaceRouter.get("/:workspaceId/invites", requirePermissionMiddleware("invite:view"), listWorkspaceInvites);
workspaceRouter.delete("/:workspaceId/invites/:inviteId", requirePermissionMiddleware("invite:revoke"), revokeInvite);

// leaving needs no special permission : every member may leave (except the owner, see the controller)
workspaceRouter.post("/:workspaceId/leave", leaveWorkspace);

export default workspaceRouter;
