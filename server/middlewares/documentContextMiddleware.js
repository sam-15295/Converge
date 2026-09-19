import mongoose from "mongoose";
import Document from "../model/documentSchema.js";

// Everything that hangs UNDER a document (its comments, its version history) is mounted behind this.
// The document is always looked up INSIDE the workspace of the URL, so a document of another workspace is simply
// "not found". On success req.document holds it. (Runs after the login and membership checks of the workspace router.)
const documentContextMiddleware = async (req, res, next)=>{
    try{
        const {documentId} = req.params;

        if(!mongoose.isValidObjectId(documentId)){
            return res.status(404).json({
                message : "Document not found"
            });
        }

        const document = await Document.findOne({_id : documentId, workspaceId : req.membership.workspaceId}).select("workspaceId title");

        if(!document){
            return res.status(404).json({
                message : "Document not found"
            });
        }

        req.document = document;
        next();
    }
    catch(err){
        console.log(err);
        res.status(500).json({message : "Internal Server Error"});
    }
}

export default documentContextMiddleware;
