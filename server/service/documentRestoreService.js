import appEvents from "../events/appEvents.js";
import {findContentProblem} from "../validators/documentContentValidator.js";
import {closeRoomLater, getRoom, persistRoom} from "./docRoomService.js";
import {contentOfState, createVersion} from "./versionService.js";
import {encodeState, fragmentName, writeJsonIntoFragment} from "./yjsService.js";

// Putting an old version back.
//
// The obvious way would be to overwrite the stored document with the old state. That would be wrong : people may be
// editing it at this very moment, and their editors are all synchronised with the LIVE document. Replacing it behind
// their backs would leave every open editor holding a document that no longer exists.
//
// So a restore is an ordinary EDIT of the live document : inside one transaction the text is replaced by the text of
// the old version. The change then travels to everybody through the normal update path, their editors converge on it,
// and it can even be undone like any other edit.
//
//     old version (stored state)  ->  readable tree  ->  written into the LIVE document, in one transaction
//                                                             |
//                                                             +-> one update -> every open editor
//                                                             +-> saved      -> MongoDB
//                                                             +-> a new version, marked RESTORE
//
// History is never rewritten : the state before the restore stays in the history, and the restore itself becomes the
// newest version. So a restore can be undone by restoring the version before it.

// marks the transaction as ours, so the update it produces can be told apart from an editor's own change
const restoreOrigin = "restore";

// Restores `version` into its document. Returns
//   {version}          the new RESTORE version that was written
//   {problem}          the version cannot be restored (its content does not pass the whitelist)
//   {notFound : true}  the document is gone
export const restoreVersion = async ({document, version, userId})=>{
    const json = contentOfState(version.yjsState);

    // Defence in depth : this text was written by our own editor and checked when it was saved, so it should always
    // pass. If a stored version somehow does not, it is refused instead of being put into the live document.
    const problem = findContentProblem(json);

    if(problem){
        return {problem};
    }

    const room = await getRoom(document._id);

    if(!room){
        return {notFound : true};
    }

    // The update the transaction produces is caught here, so it can be sent to everybody who has the document open.
    let update = null;
    const capture = (produced, origin)=>{
        if(origin === restoreOrigin){
            update = produced;
        }
    }

    room.doc.on("update", capture);

    try{
        room.doc.transact(()=>{
            // This COMPARES the old text with what is there and changes only the difference. Emptying the document
            // first and writing everything again would give the same text, but as one big "delete all, insert all"
            // change : every cursor would jump, and an edit somebody makes at that moment would be harder to keep.
            // Restoring a version that is the same as the current text therefore changes nothing at all.
            writeJsonIntoFragment(json, room.doc.getXmlFragment(fragmentName));
        }, restoreOrigin);
    }
    finally{
        room.doc.off("update", capture);
    }

    room.lastEditorId = userId;
    room.dirty = true;
    await persistRoom(room);

    // the room was perhaps only loaded to do this : let it go again if nobody has the document open
    closeRoomLater(room);

    // The state before the restore is already in the history. This marks where the restore happened, so the history
    // explains itself and the restore itself can be undone.
    const created = await createVersion({
        documentId : document._id,
        workspaceId : document.workspaceId,
        state : encodeState(room.doc),
        title : document.title,
        authorIds : [userId],
        reason : "RESTORE",
        createdBy : userId,
        restoredFromId : version._id
    });

    // the answer names the people, not only their ids (the autosave path does not need this, so it is done here)
    await created.populate([{path : "createdBy", select : "name"}, {path : "authors", select : "name"}]);

    // everybody with the document open gets the change (the socket layer listens)
    if(update){
        appEvents.emit("version:restored", {
            workspaceId : String(document.workspaceId),
            documentId : String(document._id),
            update
        });
    }

    appEvents.emit("version:created", {
        workspaceId : String(document.workspaceId),
        documentId : String(document._id),
        versionId : String(created._id),
        title : document.title,
        authorIds : [String(userId)],
        reason : "RESTORE",
        restoredFromId : String(version._id)
    });

    return {version : created};
}
