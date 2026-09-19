import mongoose from "mongoose";
import Document from "../model/documentSchema.js";
import {can, permissionsOf} from "../config/permissions.js";
import {createDocumentSchema, renameDocumentSchema} from "../validators/documentValidator.js";
import formatZodErrors from "../validators/formatZodErrors.js";
import appEvents from "../events/appEvents.js";
import {removeCommentsOfDocument} from "../service/commentService.js";

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
const findDocument = (req)=>{
    const {documentId} = req.params;

    if(!mongoose.isValidObjectId(documentId)){
        return null;
    }

    return Document.findOne({_id : documentId, workspaceId : req.membership.workspaceId});
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
        const document = await findDocument(req);

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

        // its comments go with it, and so do the notifications about them (those people have fewer unread ones now)
        for(const recipientId of await removeCommentsOfDocument(document._id)){
            appEvents.emit("notification:recount", {recipientId});
        }

        // people who have it open are sent away (the socket layer listens)
        appEvents.emit("document:deleted", {workspaceId : document.workspaceId, documentId : document._id});

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
