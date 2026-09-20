import mongoose from "mongoose";
import * as Y from "yjs";
import * as decoding from "lib0/decoding";
import {applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates} from "y-protocols/awareness";
import Document from "../model/documentSchema.js";
import WorkspaceMember from "../model/workspaceMemberSchema.js";
import {can} from "../config/permissions.js";
import appEvents from "../events/appEvents.js";
import {findUpdateProblem} from "../validators/yUpdateValidator.js";
import {getRoom, roomName, scheduleSave, canGrow, closeRoomLater, discardRoom, listRooms} from "../service/docRoomService.js";

// The real-time protocol of a document. Every message is sent with Socket.IO, updates are binary.
//
// browser -> server                        server -> browser
//   doc:join {workspaceId, documentId,       doc:sync {update, stateVector}   the part of the document the browser is missing,
//             stateVector}  (+ ack)                                           and what the server has
//   doc:update {update}                      doc:update {update}              somebody else's edit
//   doc:awareness {update}                   doc:awareness {update}           somebody else's cursor / presence
//   doc:leave                                doc:error {code, message}
//
// Joining is a two-way handshake (like the Yjs sync protocol) :
//   1. the browser sends its "state vector" = a short summary of what it already has;
//   2. the server answers with exactly the changes the browser is missing (doc:sync) and its own state vector;
//   3. the browser sends back the changes the SERVER is missing (typing done while it was offline).
// So after joining or RECONNECTING both sides have everything, and nothing is sent twice.

const accessCheckEveryMs = 5000;    // how often a busy socket re-checks in the database that it may still be here
const messagesPerSecond = 150;      // more than this is not a person typing
const maxViolations = 5;            // invalid updates before the connection is dropped
const maxAwarenessBytes = 10 * 1024;
const maxClientIdsPerSocket = 3;    // one editor = one Yjs client, a few are allowed for reconnections

// Light, clearly different colours : they are drawn on the dark editor background, and the name label puts dark text
// on top of them, so anything darker than this would be hard to see and hard to read.
const colors = ["#fb7185", "#60a5fa", "#34d399", "#fbbf24", "#a78bfa", "#22d3ee", "#f472b6", "#a3e635", "#fb923c", "#818cf8"];

// The colour of a person is chosen by the SERVER from their id, so it is the same for everybody and cannot be faked
const colorOf = (userId)=> colors[parseInt(String(userId).slice(-6), 16) % colors.length];

const toBytes = (value)=>{
    if(value instanceof Uint8Array){
        return value;
    }
    if(value instanceof ArrayBuffer){
        return new Uint8Array(value);
    }
    return null;
}

// The ids of the Yjs clients an awareness update talks about (read without applying it)
const readClientIds = (update)=>{
    const decoder = decoding.createDecoder(update);
    const count = decoding.readVarUint(decoder);

    if(count > 10){
        throw new Error("too many clients");
    }

    const ids = [];
    for(let i = 0; i < count; i++){
        ids.push(decoding.readVarUint(decoder));
        decoding.readVarUint(decoder);      // clock
        decoding.readVarString(decoder);    // state
    }
    return ids;
}

// A cursor is {anchor, head}, both small objects. Anything else is dropped, so a hostile client cannot send garbage
// that would break the cursor drawing in everybody else's editor.
const cleanCursor = (cursor)=>{
    if(cursor && typeof cursor === "object" && cursor.anchor && typeof cursor.anchor === "object" && cursor.head && typeof cursor.head === "object"
        && JSON.stringify(cursor).length <= 1000){
        return {anchor : cursor.anchor, head : cursor.head};
    }
    return null;
}

const attachDocumentHandlers = (io)=>{
    // ---------- who is in a room, and who may do what ----------

    const leaveRoom = (socket)=>{
        const current = socket.data.doc;

        if(!current){
            return;
        }
        socket.data.doc = null;
        socket.leave(roomName(current.documentId));

        const room = current.room;
        room.sockets.delete(socket.id);

        // this person's cursor disappears for everybody else
        const ownedIds = [...room.clientOwners].filter(([, owner])=> owner === socket.id).map(([clientId])=> clientId);
        if(ownedIds.length > 0){
            removeAwarenessStates(room.awareness, ownedIds, "leave");
            ownedIds.forEach((clientId)=> room.clientOwners.delete(clientId));
            io.to(roomName(current.documentId)).emit("doc:awareness", {update : encodeAwarenessUpdate(room.awareness, ownedIds)});
        }

        closeRoomLater(room);
    }

    // Re-reads the user's role from the database. Returns false when they may not be in this room any more.
    const refreshAccess = async (socket)=>{
        const current = socket.data.doc;

        if(!current){
            return false;
        }

        const membership = await WorkspaceMember.findOne({workspaceId : current.workspaceId, userId : socket.data.user.id});
        const documentExists = membership ? await Document.exists({_id : current.documentId, workspaceId : current.workspaceId}) : null;

        if(!membership || !documentExists || !can(membership.role, "document:view")){
            socket.emit("doc:error", {code : "ACCESS_REVOKED", message : "You no longer have access to this document"});
            leaveRoom(socket);
            return false;
        }

        current.canEdit = can(membership.role, "document:edit");
        current.checkedAt = Date.now();
        return true;
    }

    // Common checks for every message after joining. Returns the room's info, or null when the message must be ignored.
    const requireRoom = async (socket)=>{
        const current = socket.data.doc;

        if(!current){
            socket.emit("doc:error", {code : "NOT_JOINED", message : "Join a document first"});
            return null;
        }

        // flood protection : a person types a few times a second, not hundreds
        const now = Date.now();
        const window = socket.data.window ?? (socket.data.window = {start : now, count : 0});
        if(now - window.start > 1000){
            window.start = now;
            window.count = 0;
        }
        if(++window.count > messagesPerSecond){
            socket.emit("doc:error", {code : "RATE_LIMITED", message : "Too many messages"});
            socket.disconnect(true);
            return null;
        }

        // the database is asked again now and then, not for every keystroke
        if(now - current.checkedAt > accessCheckEveryMs && !(await refreshAccess(socket))){
            return null;
        }

        return socket.data.doc;
    }

    // ---------- the messages ----------

    const onJoin = async (socket, payload, ack)=>{
        const reply = typeof ack === "function" ? ack : ()=>{};

        try{
            const {workspaceId, documentId} = payload ?? {};
            const clientStateVector = toBytes(payload?.stateVector);

            if(!mongoose.isValidObjectId(workspaceId) || !mongoose.isValidObjectId(documentId) || !clientStateVector || clientStateVector.length > 100000){
                return reply({ok : false, error : "Document not found"});
            }

            // the same two questions as for the REST API : are you a member of THIS workspace, and does the document belong to it?
            // Every problem answers the same "not found", so nothing is revealed to outsiders.
            const membership = await WorkspaceMember.findOne({workspaceId, userId : socket.data.user.id});

            if(!membership || !can(membership.role, "document:view")){
                return reply({ok : false, error : "Document not found"});
            }
            if(!(await Document.exists({_id : documentId, workspaceId}))){
                return reply({ok : false, error : "Document not found"});
            }

            leaveRoom(socket);      // one document per connection

            const room = await getRoom(documentId);

            if(!room){
                return reply({ok : false, error : "Document not found"});
            }

            // The tab was closed while we were checking. Registering it now would leave a dead connection in the room for
            // ever (its disconnect was handled before it was registered), and the room could then never be closed.
            if(!socket.connected){
                closeRoomLater(room);
                return;
            }

            room.sockets.set(socket.id, {userId : socket.data.user.id, workspaceId});
            socket.join(roomName(documentId));
            socket.data.doc = {
                documentId : String(documentId),
                workspaceId : String(workspaceId),
                room,
                canEdit : can(membership.role, "document:edit"),
                checkedAt : Date.now(),
                violations : 0
            };

            // If the person was removed while we were checking above, the removal found nobody to remove (we were not
            // registered yet) and would never be noticed. Now that we are registered, ask once more, BEFORE sending anything.
            if(!(await refreshAccess(socket))){
                return reply({ok : false, error : "Document not found"});
            }

            // step 2 of the handshake : what the browser is missing, plus the server's state vector
            socket.emit("doc:sync", {
                update : Y.encodeStateAsUpdate(room.doc, clientStateVector),
                stateVector : Y.encodeStateVector(room.doc)
            });

            // and who is here right now (cursors of the people who joined earlier)
            const presentClientIds = [...room.awareness.getStates().keys()];
            if(presentClientIds.length > 0){
                socket.emit("doc:awareness", {update : encodeAwarenessUpdate(room.awareness, presentClientIds)});
            }

            reply({ok : true, canEdit : socket.data.doc.canEdit});
        }
        catch(err){
            console.log(err);
            reply({ok : false, error : "Something went wrong"});
        }
    }

    const onUpdate = async (socket, payload)=>{
        try{
            const current = await requireRoom(socket);

            if(!current){
                return;
            }

            if(!current.canEdit){
                return socket.emit("doc:error", {code : "READ_ONLY", message : "You can only read this document"});
            }

            const update = toBytes(payload?.update);

            // An update that is not on the whitelist is NEVER applied and never sent on. A normal editor cannot produce one,
            // so it comes from a modified client : after a few of them the connection is closed.
            const problem = update ? findUpdateProblem(update) : "The update is missing";

            if(problem){
                socket.emit("doc:error", {code : "INVALID_UPDATE", message : problem});
                if(++current.violations >= maxViolations){
                    socket.disconnect(true);
                }
                return;
            }

            if(!canGrow(current.room, update.length)){
                return socket.emit("doc:error", {code : "DOCUMENT_TOO_LARGE", message : "This document has reached its size limit"});
            }

            // apply it to the server's copy, then hand it to everybody else in the room
            Y.applyUpdate(current.room.doc, update, socket.id);
            socket.to(roomName(current.documentId)).emit("doc:update", {update});

            current.room.lastEditorId = socket.data.user.id;
            scheduleSave(current.room);
        }
        catch(err){
            console.log(err);
            socket.emit("doc:error", {code : "SERVER_ERROR", message : "Something went wrong"});
        }
    }

    // "Awareness" = presence : who is here, and where their cursor is. It is temporary and never saved.
    // The browser tells the server, but the server decides what everybody else sees :
    //   * the name and colour come from the logged in user, not from what the browser claims;
    //   * a Yjs client id belongs to the first socket that uses it, nobody else may overwrite it;
    //   * only a clean cursor is passed on.
    const onAwareness = async (socket, payload)=>{
        try{
            const current = await requireRoom(socket);

            if(!current){
                return;
            }

            const update = toBytes(payload?.update);

            if(!update || update.length > maxAwarenessBytes){
                return;
            }

            const room = current.room;
            const clientIds = readClientIds(update);

            // clients that belong to somebody else, or too many clients for one connection
            const owned = [...room.clientOwners].filter(([, owner])=> owner === socket.id).length;
            const isForeign = clientIds.some((clientId)=> room.clientOwners.has(clientId) && room.clientOwners.get(clientId) !== socket.id);
            const newOnes = clientIds.filter((clientId)=> !room.clientOwners.has(clientId)).length;

            if(isForeign || owned + newOnes > maxClientIdsPerSocket){
                return socket.emit("doc:error", {code : "INVALID_AWARENESS", message : "This presence update is not allowed"});
            }

            clientIds.forEach((clientId)=> room.clientOwners.set(clientId, socket.id));

            applyAwarenessUpdate(room.awareness, update, socket.id);

            // rewrite what was stored, so only the server's version of the identity exists
            for(const clientId of clientIds){
                const state = room.awareness.getStates().get(clientId);

                if(state){
                    room.awareness.getStates().set(clientId, {
                        user : {id : socket.data.user.id, name : socket.data.user.name, color : colorOf(socket.data.user.id)},
                        cursor : cleanCursor(state.cursor)
                    });
                }
            }

            socket.to(roomName(current.documentId)).emit("doc:awareness", {update : encodeAwarenessUpdate(room.awareness, clientIds)});
        }
        catch(err){
            // a malformed awareness message is ignored, it must never take the server down
            console.log("Ignored a bad awareness message :", err.message);
        }
    }

    // ---------- wiring ----------

    const onConnection = (socket)=>{
        socket.on("doc:join", (payload, ack)=> onJoin(socket, payload, ack));
        socket.on("doc:update", (payload)=> onUpdate(socket, payload));
        socket.on("doc:awareness", (payload)=> onAwareness(socket, payload));
        socket.on("doc:leave", ()=> leaveRoom(socket));
        socket.on("disconnect", ()=> leaveRoom(socket));
    }

    io.on("connection", onConnection);

    // ---------- reacting to things that happen elsewhere in the app ----------

    const socketsOf = (predicate)=>{
        const found = [];

        for(const room of listRooms()){
            for(const [socketId, info] of room.sockets){
                const socket = io.sockets.sockets.get(socketId);

                if(socket && predicate(info)){
                    found.push(socket);
                }
            }
        }
        return found;
    }

    // a member was removed, left, or got another role : check again what they may do
    const onMembershipChanged = ({workspaceId, userId})=>{
        socketsOf((info)=> String(info.workspaceId) === String(workspaceId) && String(info.userId) === String(userId))
        .forEach((socket)=> refreshAccess(socket));
    }

    const onWorkspaceDeleted = ({workspaceId})=>{
        socketsOf((info)=> String(info.workspaceId) === String(workspaceId)).forEach((socket)=>{
            socket.emit("doc:error", {code : "DOCUMENT_DELETED", message : "This workspace was deleted"});
            const room = socket.data.doc?.room;
            leaveRoom(socket);
            if(room){
                discardRoom(room.documentId);
            }
        });
    }

    const onDocumentDeleted = ({documentId})=>{
        const room = listRooms().find((candidate)=> candidate.documentId === String(documentId));

        if(!room){
            return;
        }

        for(const socketId of [...room.sockets.keys()]){
            const socket = io.sockets.sockets.get(socketId);

            if(socket){
                socket.emit("doc:error", {code : "DOCUMENT_DELETED", message : "This document was deleted"});
                leaveRoom(socket);
            }
        }
        discardRoom(documentId);
    }

    // An old version was put back. That change was made on the SERVER, so it is not relayed by any socket : it is sent
    // to the room here, as an ordinary update. Every open editor applies it and converges, like with anybody's edit.
    const onRestored = ({documentId, update})=>{
        io.to(roomName(documentId)).emit("doc:update", {update});
    }

    appEvents.on("membership:changed", onMembershipChanged);
    appEvents.on("workspace:deleted", onWorkspaceDeleted);
    appEvents.on("document:deleted", onDocumentDeleted);
    appEvents.on("version:restored", onRestored);

    // used when the server stops (and by tests) so listeners are not added twice
    return ()=>{
        appEvents.off("membership:changed", onMembershipChanged);
        appEvents.off("workspace:deleted", onWorkspaceDeleted);
        appEvents.off("document:deleted", onDocumentDeleted);
        appEvents.off("version:restored", onRestored);
    };
}

export default attachDocumentHandlers;
