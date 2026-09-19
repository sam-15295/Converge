import * as Y from "yjs";
import DocumentVersion from "../model/documentVersionSchema.js";
import {yDocToJSON} from "./yjsService.js";

// Reading, writing and cleaning up the history of a document.
//
// Why snapshots and not a record per change : a document is edited letter by letter, so storing every change would be
// enormous and useless to read. Instead the live room collects an EDITING SESSION and asks for one version when it ends
// (see service/docRoomService.js). A version is therefore "how the document looked after somebody worked on it".
//
// How many are kept : the newest `maxVersionsPerDocument` per document. Older ones are deleted when a new one is written,
// so history cannot grow without limit. (A real product would keep fewer, further apart, the older they get.)

export const maxVersionsPerDocument = 50;

const people = "name";

const asIsoDate = (value)=> value ? new Date(value).toISOString() : null;

const asPerson = (user)=>{
    if(!user){
        return null;
    }
    return {id : String(user._id ?? user), name : user.name ?? null};
}

// What is sent to clients : metadata only. The state itself is large, so it is only read when somebody opens a version.
export const formatVersion = (version)=>{
    return {
        id : String(version._id),
        documentId : String(version.documentId),
        title : version.title,
        authors : (version.authors ?? []).map(asPerson).filter(Boolean),
        reason : version.reason,
        createdBy : asPerson(version.createdBy),
        restoredFromId : version.restoredFromId ? String(version.restoredFromId) : null,
        byteSize : version.byteSize,
        createdAt : asIsoDate(version.createdAt)
    };
}

// Deletes everything but the newest `maxVersionsPerDocument` versions of a document.
const prune = async (documentId)=>{
    const stale = await DocumentVersion.find({documentId})
    .sort({createdAt : -1, _id : -1})
    .skip(maxVersionsPerDocument)
    .select("_id");

    if(stale.length > 0){
        await DocumentVersion.deleteMany({_id : {$in : stale.map((version)=> version._id)}});
    }
    return stale.length;
}

// Writes one version. `state` is the whole Yjs document as a Uint8Array.
export const createVersion = async ({documentId, workspaceId, state, title, authorIds = [], reason = "AUTOSAVE", createdBy = null, restoredFromId = null})=>{
    const unique = [...new Set(authorIds.filter(Boolean).map(String))];

    const version = await DocumentVersion.create({
        documentId,
        workspaceId,
        yjsState : Buffer.from(state),
        title,
        authors : unique,
        reason,
        createdBy,
        restoredFromId,
        byteSize : state.length
    });

    await prune(documentId);
    return version;
}

// The versions of a document, newest first, read with a CURSOR (the id of the last one the client has), like the chat
// history and the comments. Returns {versions, hasMore}, or null when the cursor is not a version of this document.
export const findVersions = async ({documentId, before, limit})=>{
    const filter = {documentId};

    if(before){
        const cursor = await DocumentVersion.findOne({_id : before, documentId}).select("createdAt");

        if(!cursor){
            return null;
        }
        filter.$or = [
            {createdAt : {$lt : cursor.createdAt}},
            {createdAt : cursor.createdAt, _id : {$lt : cursor._id}}
        ];
    }

    // one extra tells whether there is more, without a second query
    const found = await DocumentVersion.find(filter)
    .populate("authors", people)
    .populate("createdBy", people)
    .sort({createdAt : -1, _id : -1})
    .limit(limit + 1);

    return {versions: found.slice(0, limit).map(formatVersion), hasMore : found.length > limit};
}

// One version of THIS document, with its Yjs state. null when it belongs to another document (or does not exist).
export const findVersionWithState = (documentId, versionId)=>{
    return DocumentVersion.findOne({_id : versionId, documentId}).select("+yjsState").populate("authors", people).populate("createdBy", people);
}

// The readable tree of a stored state. It is worked out here instead of being stored a second time, so a version can
// never disagree with itself. The Y.Doc is thrown away right after.
export const contentOfState = (state)=>{
    const doc = new Y.Doc();

    try{
        Y.applyUpdate(doc, new Uint8Array(state));
        return yDocToJSON(doc);
    }
    finally{
        doc.destroy();
    }
}

export const countVersions = (documentId)=> DocumentVersion.countDocuments({documentId});

// the document was deleted : its history goes with it
export const removeVersionsOfDocument = (documentId)=> DocumentVersion.deleteMany({documentId});
