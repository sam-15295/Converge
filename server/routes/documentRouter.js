import express from "express";
import {createDocument, listDocuments, getDocument, renameDocument, deleteDocument, saveContent} from "../controllers/documentController.js";
import requirePermissionMiddleware from "../middlewares/requirePermissionMiddleware.js";

// mergeParams : so :workspaceId from the parent router is available here
// The routes below are mounted inside workspaceRouter, AFTER authUserMiddleware and workspaceMemberMiddleware,
// so every document route already knows the user is logged in and a member of the workspace.
const documentRouter = express.Router({mergeParams : true});

documentRouter.post("/", requirePermissionMiddleware("document:create"), createDocument);
documentRouter.get("/", requirePermissionMiddleware("document:view"), listDocuments);
documentRouter.get("/:documentId", requirePermissionMiddleware("document:view"), getDocument);
documentRouter.patch("/:documentId", requirePermissionMiddleware("document:edit"), renameDocument);
documentRouter.put("/:documentId/content", requirePermissionMiddleware("document:edit"), saveContent);

// no fixed permission here : who may delete depends on the role AND on who created the document (see the controller)
documentRouter.delete("/:documentId", deleteDocument);

export default documentRouter;
