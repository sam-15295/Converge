import express from "express";
import {listComments, getThread, createComment} from "../controllers/commentController.js";
import requirePermissionMiddleware from "../middlewares/requirePermissionMiddleware.js";
import commentRateLimitMiddleware from "../middlewares/commentRateLimitMiddleware.js";

// mergeParams : so :workspaceId and :documentId from the parent routers are available here.
// Mounted inside documentRouter, AFTER the login, the membership and the "is this a document of this workspace" checks.
const commentRouter = express.Router({mergeParams : true});

commentRouter.get("/", requirePermissionMiddleware("comment:view"), listComments);
commentRouter.get("/:commentId", requirePermissionMiddleware("comment:view"), getThread);
commentRouter.post("/", requirePermissionMiddleware("comment:create"), commentRateLimitMiddleware, createComment);

export default commentRouter;
