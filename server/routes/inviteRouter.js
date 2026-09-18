import express from "express";
import {getMyInvites, acceptInvite, declineInvite} from "../controllers/workspaceInviteController.js";
import authUserMiddleware from "../middlewares/authUserMiddleware.js";

// The invited person's side : "invitations addressed to ME".
// (Creating, listing and cancelling invitations of a workspace is in workspaceRouter.js.)
const inviteRouter = express.Router();

inviteRouter.use(authUserMiddleware);

inviteRouter.get("/", getMyInvites);
inviteRouter.post("/:inviteId/accept", acceptInvite);
inviteRouter.post("/:inviteId/decline", declineInvite);

export default inviteRouter;
