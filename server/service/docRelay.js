import {randomUUID} from "node:crypto";
import * as Y from "yjs";
import {createSubscriber, getRedis} from "../config/redis.js";

// Keeping every server's COPY of a live document complete.
//
// The browsers already reach each other : the Socket.IO adapter carries `doc:update` to the people in the room on
// every server. But each server also keeps its own copy of the document in memory, and that copy only ever saw the
// edits of ITS OWN browsers. That copy is what gets saved, versioned, and handed to the next person who opens the
// document - so an incomplete one loses work.
//
// This file gives each open document a Redis channel that the servers holding it talk on :
//
//     server A applies an edit  ->  doc:<id>  ->  server B applies it to its own copy (and does NOT send it back)
//     server B opens the document ->  "who has this?"  ->  the others answer with their whole copy
//
// Nothing is sent to browsers from here : that is the adapter's job. This is only about the servers' own copies.
//
// Updates travel as base64 inside a small JSON message. Binary would be a little smaller, but an update is a few
// dozen bytes and this keeps the channel readable and the code simple.

const relayOrigin = "relay";        // marks changes that came from another server, so they are never sent back
const instanceId = randomUUID();

let subscriber = null;                      // one connection, listening to every open document's channel
const rooms = new Map();                    // documentId -> {doc, onUpdate}

const channelOf = (documentId)=> `doc:${documentId}`;

const publish = (documentId, message)=>{
    const redis = getRedis();

    if(redis){
        redis.publish(channelOf(documentId), JSON.stringify({from : instanceId, ...message}))
        .catch((err)=> console.log("Could not send a document change to the other servers", err.message));
    }
}

// what arrives on a document's channel from ANOTHER server
const onMessage = (documentId)=> (raw)=>{
    const room = rooms.get(String(documentId));

    if(!room){
        return;
    }

    try{
        const message = JSON.parse(raw);

        if(message.from === instanceId){
            return;                         // our own message coming back
        }

        // somebody just opened this document and has nothing but what the database gave them : send our copy
        if(message.kind === "state-request"){
            publish(documentId, {kind : "state", update : Buffer.from(Y.encodeStateAsUpdate(room.doc)).toString("base64")});
            return;
        }

        // an edit, or somebody's whole copy. Yjs does not care which, nor in what order they arrive.
        // The origin marks it as coming from outside, so the listener below does not send it straight back.
        Y.applyUpdate(room.doc, new Uint8Array(Buffer.from(message.update, "base64")), relayOrigin);
    }
    catch(err){
        console.log("A document change from another server could not be read", err.message);
    }
}

// Starts sharing this room's document with the other servers. Called when a room is loaded, before it is used.
export const joinDocRelay = async (room)=>{
    if(!getRedis()){
        return;
    }

    const documentId = String(room.documentId);

    // every change to this copy that did NOT come from another server is passed on (a browser's edit, a restore)
    const onUpdate = (update, origin)=>{
        if(origin === relayOrigin){
            return;
        }
        publish(documentId, {kind : "update", update : Buffer.from(update).toString("base64")});
    };

    rooms.set(documentId, {doc : room.doc, onUpdate});
    room.doc.on("update", onUpdate);

    subscriber = subscriber ?? await createSubscriber();
    await subscriber.subscribe(channelOf(documentId), onMessage(documentId));
}

// Asks the other servers for their copy. What the database holds can be a couple of seconds behind whatever somebody
// is typing on another server right now, and this closes that gap. Answers that arrive later are applied anyway.
export const askOthersForTheDocument = async (room, waitMs = 150)=>{
    if(!getRedis()){
        return;
    }

    publish(String(room.documentId), {kind : "state-request"});
    await new Promise((resolve)=> setTimeout(resolve, waitMs));
}

export const leaveDocRelay = async (room)=>{
    const documentId = String(room.documentId);
    const known = rooms.get(documentId);

    if(!known){
        return;
    }

    rooms.delete(documentId);
    room.doc.off("update", known.onUpdate);
    await subscriber?.unsubscribe(channelOf(documentId)).catch(()=> {});
}

// used when the server stops, and by tests
export const closeDocRelay = async ()=>{
    rooms.clear();
    const closing = subscriber;
    subscriber = null;
    await closing?.quit().catch(()=> {});
}

export const docRelayOrigin = relayOrigin;
