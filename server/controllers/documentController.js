import mongoose from "mongoose";
import Document from "../model/documentSchema.js";
import {can, permissionsOf} from "../config/permissions.js";
import {createDocumentSchema, renameDocumentSchema, saveContentSchema} from "../validators/documentValidator.js";
import formatZodErrors from "../validators/formatZodErrors.js";

// what the document list shows (never the content, it can be large)
const formatDocumentSummary = (document, membership, user)=>{
    return {
        id : document._id,
        title : document.title,
        createdBy : document.createdBy?.name,
        updatedAt : document.updatedAt,
        canDelete : canDeleteDocument(membership, document, user)
    };
}

// Deleting depends on the role AND on who created the document :
// OWNER and ADMIN may delete any document, a MEMBER only the ones they created.
const canDeleteDocument = (membership, document, user)=>{
    const createdByMe = String(document.createdBy?._id ?? document.createdBy) === String(user._id);

    return can(membership.role, "document:delete") || (can(membership.role, "document:deleteOwn") && createdByMe);
}

// The document of the URL, always looked up INSIDE the workspace of the URL.
// A document id of another workspace is simply "not found".
const findDocument = (req, {withContent = false} = {})=>{
    const {documentId} = req.params;

    if(!mongoose.isValidObjectId(documentId)){
        return null;
    }

    const query = Document.findOne({_id : documentId, workspaceId : req.membership.workspaceId});
    return withContent ? query.select("+content") : query;
}

export const createDocument = async (req, res)=>{
    try{
        const result = createDocumentSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const document = await Document.create({
            workspaceId : req.membership.workspaceId,
            title : result.data.title,
            createdBy : req.user._id
        });

        res.status(201).json({
            message : "Document created Successfully",
            document : {id : document._id, title : document.title, version : document.version}
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const listDocuments = async (req, res)=>{
    try{
        const documents = await Document.find({workspaceId : req.membership.workspaceId})
        .populate("createdBy", "name")
        .sort({updatedAt : -1})
        .limit(200);

        res.status(200).json({
            message : "Workspace documents",
            documents : documents.map((document)=> formatDocumentSummary(document, req.membership, req.user))
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const getDocument = async (req, res)=>{
    try{
        const document = await findDocument(req, {withContent : true});

        if(!document){
            return res.status(404).json({
                message : "Document not found"
            });
        }

        res.status(200).json({
            message : "Your document",
            document : {
                id : document._id,
                title : document.title,
                content : document.content,
                version : document.version,
                updatedAt : document.updatedAt
            },
            permissions : permissionsOf(req.membership.role),
            canDelete : canDeleteDocument(req.membership, document, req.user)
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const renameDocument = async (req, res)=>{
    try{
        const result = renameDocumentSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const document = await findDocument(req);

        if(!document){
            return res.status(404).json({
                message : "Document not found"
            });
        }

        document.title = result.data.title;
        await document.save();

        res.status(200).json({
            message : "Document renamed Successfully",
            document : {id : document._id, title : document.title}
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const deleteDocument = async (req, res)=>{
    try{
        const document = await findDocument(req);

        if(!document){
            return res.status(404).json({
                message : "Document not found"
            });
        }

        if(!canDeleteDocument(req.membership, document, req.user)){
            return res.status(403).json({
                message : "You can only delete documents you created yourself"
            });
        }

        await document.deleteOne();

        res.status(200).json({
            message : "Document deleted Successfully"
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

// Saves the content of the editor.
// Optimistic locking : the update only matches while the document is STILL at the version the editor
// started from. So if somebody else saved in the meantime, this save matches nothing and gets a 409,
// instead of silently overwriting their work. The check and the update are one atomic database
// operation, so two saves at the same moment can never both win.
export const saveContent = async (req, res)=>{
    try{
        const {documentId} = req.params;

        if(!mongoose.isValidObjectId(documentId)){
            return res.status(404).json({
                message : "Document not found"
            });
        }

        const result = saveContentSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const {content, version} = result.data;
        const workspaceId = req.membership.workspaceId;

        const saved = await Document.findOneAndUpdate(
            {_id : documentId, workspaceId, version},
            {$set : {content, lastEditedBy : req.user._id}, $inc : {version : 1}},
            {new : true, projection : {version : 1, updatedAt : 1}}
        );

        if(!saved){
            // no match : the document does not exist in this workspace, or it moved on to a newer version
            const exists = await Document.exists({_id : documentId, workspaceId});

            if(!exists){
                return res.status(404).json({
                    message : "Document not found"
                });
            }

            return res.status(409).json({
                message : "This document was changed by someone else. Reload to see the latest version."
            });
        }

        res.status(200).json({
            message : "Document saved Successfully",
            version : saved.version,
            updatedAt : saved.updatedAt
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}
