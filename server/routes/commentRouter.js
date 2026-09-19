import express from "express";
import {listComments, getThread, createComment, resolveThread, reopenThread, deleteComment} from "../controllers/commentController.js";
import requirePermissionMiddleware from "../middlewares/requirePermissionMiddleware.js";
import commentRateLimitMiddleware from "../middlewares/commentRateLimitMiddleware.js";

// mergeParams : so :workspaceId and :documentId from the parent routers are available here.
// Mounted inside documentRouter, AFTER the login, the membership and the "is this a document of this workspace" checks.
const commentRouter = express.Router({mergeParams : true});

commentRouter.get("/", requirePermissionMiddleware("comment:view"), listComments);
commentRouter.get("/:commentId", requirePermissionMiddleware("comment:view"), getThread);
commentRouter.post("/", requirePermissionMiddleware("comment:create"), commentRateLimitMiddleware, createComment);

// resolving a thread and opening it again (either can be repeated safely)
commentRouter.post("/:commentId/resolve", requirePermissionMiddleware("comment:resolve"), resolveThread);
commentRouter.post("/:commentId/reopen", requirePermissionMiddleware("comment:resolve"), reopenThread);

// no fixed permission here : who may delete depends on the role AND on who wrote the comment (see the controller)
commentRouter.delete("/:commentId", deleteComment);

export default commentRouter;
