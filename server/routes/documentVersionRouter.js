import express from "express";
import {getVersion, listVersions} from "../controllers/documentVersionController.js";
import requirePermissionMiddleware from "../middlewares/requirePermissionMiddleware.js";

// mergeParams : so :workspaceId and :documentId from the parent routers are available here.
// Mounted inside documentRouter, AFTER the login, the membership and the "is this a document of this workspace" checks.
const documentVersionRouter = express.Router({mergeParams : true});

documentVersionRouter.get("/", requirePermissionMiddleware("version:view"), listVersions);
documentVersionRouter.get("/:versionId", requirePermissionMiddleware("version:view"), getVersion);

export default documentVersionRouter;
