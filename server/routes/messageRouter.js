import express from "express";
import {sendMessage, listMessages, listReplies} from "../controllers/messageController.js";
import requirePermissionMiddleware from "../middlewares/requirePermissionMiddleware.js";
import messageRateLimitMiddleware from "../middlewares/messageRateLimitMiddleware.js";

// mergeParams : so :workspaceId from the parent router is available here.
// Mounted inside workspaceRouter, AFTER the login and membership checks, like the document routes.
const messageRouter = express.Router({mergeParams : true});

messageRouter.get("/", requirePermissionMiddleware("chat:view"), listMessages);
messageRouter.post("/", requirePermissionMiddleware("chat:send"), messageRateLimitMiddleware, sendMessage);
messageRouter.get("/:messageId/replies", requirePermissionMiddleware("chat:view"), listReplies);

export default messageRouter;
