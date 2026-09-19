import env from "../config/env.js";
import Document from "../model/documentSchema.js";
import appEvents from "../events/appEvents.js";
import {createVersion} from "./versionService.js";

// WHEN a version of a document is written.
//
// The rule : a version is written when an EDITING SESSION ends, and never more often than once every few minutes
// per document.
//
//     somebody types  ->  quiet for VERSION_QUIET_SECONDS  ->  write a version
//     everybody left  ->  write a version as soon as the gap since the last one allows it
//
// So a whole afternoon of typing does not become thousands of rows, and a document nobody touches produces nothing.
// A session that ends inside the gap is not dropped, only delayed : the timer moves to the end of the gap and the
// version is written then, from whatever is stored at that moment.
//
// The state is read from MONGODB, never from the live room. The room saves itself every two seconds, and a version is
// written minutes later, so the stored state is the same thing — and this file then needs to know nothing about rooms.
//
// Who is credited : everybody who edited since the previous version, collected here. They survive the room being
// closed and reopened, so a session split over two visits still credits both people.

const quietMs = ()=> env.VERSION_QUIET_SECONDS * 1000;
const minGapMs = ()=> env.VERSION_MIN_GAP_SECONDS * 1000;

// documentId -> {workspaceId, authors : Set, timer, lastVersionAt}
const sessions = new Map();

// The live room saves itself on its own rhythm, which is much shorter than the periods here, but "much shorter" is not
// "always first". So before a version is read from the database, the room is asked to save whatever it still holds.
// docRoomService registers that here (instead of being imported) so the two files do not depend on each other.
let saveLiveChanges = async ()=>{};

export const onBeforeVersion = (save)=>{
    saveLiveChanges = save;
}

const sessionOf = (documentId, workspaceId)=>{
    const key = String(documentId);
    const existing = sessions.get(key);

    if(existing){
        if(workspaceId){
            existing.workspaceId = String(workspaceId);
        }
        return existing;
    }

    const fresh = {workspaceId : workspaceId ? String(workspaceId) : null, authors : new Set(), timer : null, plannedFor : 0, lastVersionAt : 0};
    sessions.set(key, fresh);
    return fresh;
}

const clearTimer = (session)=>{
    if(session.timer){
        clearTimeout(session.timer);
        session.timer = null;
    }
}

// Writes the version now, from the state stored in MongoDB. Nothing happens when there is nothing to save,
// or when the document is gone.
const writeVersion = async (documentId)=>{
    const session = sessions.get(String(documentId));

    if(!session || session.authors.size === 0){
        return null;
    }

    const authorIds = [...session.authors];

    // taken before awaiting : an edit arriving while we save starts the NEXT session instead of being swallowed
    session.authors.clear();
    session.lastVersionAt = Date.now();

    try{
        // whatever is still only in memory goes to the database first, so the version is the real current state
        await saveLiveChanges(documentId);

        const stored = await Document.findById(documentId).select("+yjsState");

        if(!stored || !stored.yjsState || stored.yjsState.length === 0){
            return null;
        }

        const version = await createVersion({
            documentId : stored._id,
            workspaceId : stored.workspaceId,
            state : stored.yjsState,
            title : stored.title,
            authorIds
        });

        appEvents.emit("version:created", {
            workspaceId : String(stored.workspaceId),
            documentId : String(stored._id),
            versionId : String(version._id),
            title : stored.title,
            authorIds,
            reason : "AUTOSAVE"
        });

        return version;
    }
    catch(err){
        // the edits are not lost : they are in the document, and the next session writes a version that includes them
        console.log(`Writing a version of document ${documentId} failed`, err);
        return null;
    }
}

// Asks for a version in `delayMs`, or earlier than already planned. The gap since the last version is always respected.
const planVersion = (session, documentId, delayMs)=>{
    const earliest = Math.max(Date.now() + delayMs, session.lastVersionAt + minGapMs());
    const waitMs = Math.max(0, earliest - Date.now());

    if(session.timer){
        // a timer that already fires early enough is left alone (an edit every minute must not push it away for ever)
        if(session.plannedFor <= earliest){
            return;
        }
        clearTimer(session);
    }

    session.plannedFor = earliest;
    session.timer = setTimeout(()=>{
        session.timer = null;
        writeVersion(documentId);
    }, waitMs);
    session.timer.unref();
}

// Somebody changed the document. Called for every edit, so it must stay cheap : it only remembers who, and moves a timer.
export const noteEdit = ({documentId, workspaceId, userId})=>{
    const session = sessionOf(documentId, workspaceId);

    if(userId){
        session.authors.add(String(userId));
    }
    planVersion(session, String(documentId), quietMs());
}

// The last person closed the document : the session is over, so write as soon as the gap allows instead of waiting
// for the quiet period.
export const endSession = (documentId)=>{
    const session = sessions.get(String(documentId));

    if(!session || session.authors.size === 0){
        return;
    }
    planVersion(session, String(documentId), 0);
}

// The document (or its workspace) was deleted : forget it without writing anything.
export const forgetDocument = (documentId)=>{
    const session = sessions.get(String(documentId));

    if(session){
        clearTimer(session);
        sessions.delete(String(documentId));
    }
}

// Server shutdown (and the end of a test) : write what is waiting, ignoring the gap, so a session is not lost.
export const flushAllVersions = async ()=>{
    for(const [documentId, session] of [...sessions.entries()]){
        clearTimer(session);

        if(session.authors.size > 0){
            await writeVersion(documentId);
        }
    }
}

// Frees everything WITHOUT writing (tests use this between runs)
export const resetVersionScheduler = ()=>{
    for(const session of sessions.values()){
        clearTimer(session);
    }
    sessions.clear();
}
