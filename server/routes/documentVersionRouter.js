import express from "express";
import {getVersion, listVersions, restoreVersion} from "../controllers/documentVersionController.js";
import requirePermissionMiddleware from "../middlewares/requirePermissionMiddleware.js";

// mergeParams : so :workspaceId and :documentId from the parent routers are available here.
// Mounted inside documentRouter, AFTER the login, the membership and the "is this a document of this workspace" checks.
const documentVersionRouter = express.Router({mergeParams : true});

documentVersionRouter.get("/", requirePermissionMiddleware("version:view"), listVersions);
documentVersionRouter.get("/:versionId", requirePermissionMiddleware("version:view"), getVersion);

// putting an old version back is an EDIT of the document, so it needs more than the right to read the history
documentVersionRouter.post("/:versionId/restore", requirePermissionMiddleware("version:restore"), restoreVersion);

export default documentVersionRouter;
