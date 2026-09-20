import * as Y from "yjs";
import {Awareness} from "y-protocols/awareness";
import Document from "../model/documentSchema.js";
import {jsonToYDoc, yDocToJSON, encodeState} from "./yjsService.js";
import {findContentProblem} from "../validators/documentContentValidator.js";
import {endSession, forgetDocument, noteEdit, onBeforeVersion, resetVersionScheduler} from "./versionScheduler.js";
import {askOthersForTheDocument, closeDocRelay, docRelayOrigin, joinDocRelay, leaveDocRelay} from "./docRelay.js";
import {withLock} from "./redisLock.js";

// One "room" = one document that people have open right now.
// The room holds the live Yjs document in memory (the server's copy, which every editor syncs with)
// and the awareness (who is here, where their cursor is: temporary, never saved).
//
// Life of a room :  first person opens the document  -> loaded from MongoDB
//                   people type                       -> updates are applied here and saved (at most every 2 seconds)
//                   last person leaves                -> saved, then removed from memory after a short grace period
//
// Every server that has the document open keeps its OWN copy of it in memory. They are held together by the relay
// (service/docRelay.js) : each server passes on the edits it receives, and asks the others for their copy when it
// opens a document. Saving happens one server at a time, under a lock, and always merges what is already stored.

const saveDelayMs = 2000;           // saves are throttled : at most one every 2 seconds while people type
const saveLockMs = 5000;            // long enough for one save, short enough that a dead server frees it quickly
const closeDelayMs = 5000;          // a room stays in memory a moment after the last person leaves (page reloads)
const maxDocumentBytes = 8 * 1024 * 1024;   // safety valve : a document may not grow beyond this

const rooms = new Map();        // documentId -> room
const loading = new Map();      // documentId -> Promise of a room that is being loaded

export const roomName = (documentId)=> `doc:${documentId}`;

// Loads the document from MongoDB into a new room
const loadRoom = async (documentId)=>{
    const stored = await Document.findById(documentId).select("+yjsState +content");

    if(!stored){
        return null;
    }

    const doc = new Y.Doc();
    let needsFirstSave = false;

    // Listening starts BEFORE the document is read, so an edit made on another server while we are reading is not
    // missed : it is simply applied on top.
    await joinDocRelay({documentId : String(documentId), doc});

    if(stored.yjsState && stored.yjsState.length > 0){
        Y.applyUpdate(doc, new Uint8Array(stored.yjsState));
    }
    else if(stored.content && findContentProblem(stored.content) === null){
        // A document from before real-time editing : it only has the JSON snapshot. Turn it into a Yjs document ONCE, here,
        // on the server, so two people opening it at the same moment do not both create their own copy of the text.
        Y.applyUpdate(doc, encodeState(jsonToYDoc(stored.content)));
        needsFirstSave = true;
    }

    const room = {
        documentId : String(documentId),
        workspaceId : String(stored.workspaceId),
        doc,
        awareness : new Awareness(doc),
        sockets : new Map(),            // socketId -> {userId, workspaceId}
        clientOwners : new Map(),       // awareness clientID -> socketId that owns it
        dirty : false,
        lastEditorId : null,
        saveTimer : null,
        saving : Promise.resolve(),
        closeTimer : null,
        closePromise : null,
        discarded : false,
        destroyed : false,
        approxBytes : Y.encodeStateAsUpdate(doc).length
    };

    // The server's own awareness state is not a person. Remove it so it is never sent to anybody.
    room.awareness.setLocalState(null);

    rooms.set(room.documentId, room);

    // What the database holds can be a couple of seconds behind what somebody is typing on another server right
    // now, so the others are asked for their copy before anybody is given this one.
    await askOthersForTheDocument(room);

    if(needsFirstSave){
        room.dirty = true;
        await persistRoom(room);
    }

    return room;
}

// Returns the room of a document, loading it on first use. null when the document does not exist.
export const getRoom = async (documentId)=>{
    const key = String(documentId);
    const existing = rooms.get(key);

    if(existing){
        if(existing.closePromise){
            // it is being saved and removed right now : wait, then load a fresh one from the saved state
            await existing.closePromise;
            return getRoom(key);
        }
        clearTimeout(existing.closeTimer);
        existing.closeTimer = null;
        return existing;
    }

    if(!loading.has(key)){
        loading.set(key, loadRoom(key).finally(()=> loading.delete(key)));
    }

    return loading.get(key);
}

export const getOpenRoom = (documentId)=> rooms.get(String(documentId));

// The history is about to read this document from the database : if it is open here, save what is still only in memory.
// (Nothing happens for a document nobody has open : its last state is already stored.)
onBeforeVersion(async (documentId)=>{
    const room = rooms.get(String(documentId));

    if(room && !room.destroyed){
        await persistRoom(room);
    }
});

export const listRooms = ()=> [...rooms.values()];

// Saves the room to MongoDB. Saves of one room never overlap (each waits for the previous one).
export const persistRoom = (room)=>{
    room.saving = room.saving.then(async ()=>{
        if(!room.dirty || room.discarded){
            return;
        }

        room.dirty = false;     // changes that arrive WHILE saving set it again and cause another save

        // Only one server may save a document at a time. Two saving together could each write their own copy, and the
        // slower one would undo the other's work. A server that cannot take the lock simply tries again on its next
        // save : nothing is lost, it is only written a moment later.
        const saved = await withLock(`doc:save:${room.documentId}`, saveLockMs, ()=> writeRoom(room), "busy");

        if(saved === "busy"){
            room.dirty = true;
        }
    });

    return room.saving;
}

// Writes the room to MongoDB. Runs while holding the save lock (or alone, when there is no Redis).
const writeRoom = async (room)=>{
    try{
        // What is already stored is merged into our copy FIRST. Merging a CRDT only ever ADDS, so what we write is
        // everything we know plus everything the database knew : an edit made on another server can never be written
        // over. The relay origin keeps this from being sent back out as if it were a new change.
        const stored = await Document.findById(room.documentId).select("+yjsState");

        if(stored?.yjsState?.length){
            Y.applyUpdate(room.doc, new Uint8Array(stored.yjsState), docRelayOrigin);
        }

        const json = yDocToJSON(room.doc);
        const problem = findContentProblem(json);

        // Second layer of the rich-text whitelist : incoming updates were already checked one by one, this checks the
        // WHOLE document before it is stored. It should never fail. If it does, nothing is written, so the last good
        // state stays in the database.
        if(problem){
            console.log(`Document ${room.documentId} was NOT saved, its content is not valid : ${problem}`);
            return;
        }

        await Document.updateOne({_id : room.documentId}, {$set : {
            yjsState : Buffer.from(encodeState(room.doc)),
            content : json,
            ...(room.lastEditorId ? {lastEditedBy : room.lastEditorId} : {})
        }});
    }
    catch(err){
        room.dirty = true;      // try again with the next save
        console.log(`Saving document ${room.documentId} failed`, err);
    }
}

// Called after every change : make sure a save happens soon, but not on every keystroke
export const scheduleSave = (room)=>{
    room.dirty = true;

    // the history works on much longer periods than a save : it only notes who edited and when the typing stops
    noteEdit({documentId : room.documentId, workspaceId : room.workspaceId, userId : room.lastEditorId});

    if(!room.saveTimer){
        room.saveTimer = setTimeout(()=>{
            room.saveTimer = null;
            persistRoom(room);
        }, saveDelayMs);
        room.saveTimer.unref();
    }
}

// How much a room may still grow (a rough estimate that only goes up until the room is reloaded)
export const canGrow = (room, extraBytes)=>{
    room.approxBytes += extraBytes;
    return room.approxBytes <= maxDocumentBytes;
}

const destroyRoom = (room)=>{
    if(room.destroyed){
        return;
    }
    room.destroyed = true;
    leaveDocRelay(room);        // stop listening for this document's changes
    clearTimeout(room.saveTimer);
    clearTimeout(room.closeTimer);
    room.awareness.destroy();
    room.doc.destroy();
    rooms.delete(room.documentId);
}

// Called when the last person left : after a short wait, save and free the memory
export const closeRoomLater = (room)=>{
    if(room.destroyed || room.sockets.size > 0 || room.closeTimer){
        return;
    }

    room.closeTimer = setTimeout(()=>{
        room.closeTimer = null;
        if(room.sockets.size > 0){
            return;
        }

        // Everybody has left, so the editing session is over : the history may write its version now (it reads the
        // state from the database, which the save above has just brought up to date).
        room.closePromise = persistRoom(room).then(()=>{
            destroyRoom(room);
            endSession(room.documentId);
        });
    }, closeDelayMs);
    room.closeTimer.unref();
}

// The document was deleted : forget the room WITHOUT saving (it must not come back to life)
export const discardRoom = (documentId)=>{
    const room = rooms.get(String(documentId));

    if(room){
        room.discarded = true;
        destroyRoom(room);
    }
    // no version of a document that no longer exists
    forgetDocument(documentId);
    return room;
}

// Server shutdown (or the end of a test) : save everything that is not saved yet
export const flushAllRooms = async ()=>{
    for(const room of [...rooms.values()]){
        clearTimeout(room.saveTimer);
        room.saveTimer = null;
        await persistRoom(room);
    }
}

// Frees everything (tests use this between runs)
export const resetRooms = async ()=>{
    await flushAllRooms();

    for(const room of [...rooms.values()]){
        destroyRoom(room);
    }
    loading.clear();
    resetVersionScheduler();
    await closeDocRelay();
}

