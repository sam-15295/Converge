import mongoose from "mongoose";
import formatZodErrors from "../validators/formatZodErrors.js";
import {listVersionsQuerySchema} from "../validators/versionValidator.js";
import {contentOfState, findVersionWithState, findVersions, formatVersion} from "../service/versionService.js";
import {restoreVersion as putVersionBack} from "../service/documentRestoreService.js";

// The history of a document. Everything is looked up INSIDE the document of the URL (which documentContextMiddleware
// already checked to be a document of this workspace), so a version id of another document is "not found".

export const listVersions = async (req, res)=>{
    try{
        const result = listVersionsQuerySchema.safeParse(req.query);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const {limit, before} = result.data;
        const page = await findVersions({documentId : req.document._id, before, limit});

        // the cursor is not a version of this document
        if(!page){
            return res.status(404).json({
                message : "Version not found"
            });
        }

        res.status(200).json({
            message : "Versions",
            versions : page.versions,
            hasMore : page.hasMore
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

// One version, with the text it holds. The stored state is turned into the readable tree here, so the browser gets
// the same shape the editor uses and can show it without knowing anything about Yjs.
export const getVersion = async (req, res)=>{
    try{
        const {versionId} = req.params;
        const version = mongoose.isValidObjectId(versionId) ? await findVersionWithState(req.document._id, versionId) : null;

        if(!version){
            return res.status(404).json({
                message : "Version not found"
            });
        }

        res.status(200).json({
            message : "Version",
            version : formatVersion(version),
            content : contentOfState(version.yjsState)
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

// Puts an old version back. The document keeps being edited live while this happens : see documentRestoreService.
export const restoreVersion = async (req, res)=>{
    try{
        const {versionId} = req.params;
        const version = mongoose.isValidObjectId(versionId) ? await findVersionWithState(req.document._id, versionId) : null;

        if(!version){
            return res.status(404).json({
                message : "Version not found"
            });
        }

        const result = await putVersionBack({document : req.document, version, userId : req.user._id});

        if(result.notFound){
            return res.status(404).json({
                message : "Document not found"
            });
        }
        if(result.problem){
            return res.status(409).json({
                message : "This version cannot be restored"
            });
        }

        res.status(201).json({
            message : "Version restored Successfully",
            version : formatVersion(result.version)
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}
