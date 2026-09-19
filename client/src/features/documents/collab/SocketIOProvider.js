import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import { io } from "socket.io-client";

// Connects ONE Yjs document to the server, over Socket.IO. A "provider" is the piece that moves a Yjs document's
// changes between this browser and everybody else. (Yjs has ready-made providers for its own WebSocket server,
// but our transport is Socket.IO with our own login and permission checks, so this one is ours.)
//
// The protocol (the same one the server tests use) :
//   join      -> doc:join {workspaceId, documentId, stateVector}     "here is a summary of what I already have"
//   sync      <- doc:sync {update, stateVector}                      what I was missing, and the server's summary
//   sync back -> doc:update {update}                                 what the SERVER was missing (typed while offline)
//   typing    -> doc:update {update}   /  <- doc:update {update}     live edits both ways
//   presence  -> doc:awareness  /  <- doc:awareness                 who is here and where their cursor is
//
// Going offline and coming back needs no special code : the Yjs document keeps every local edit, and the join
// handshake after reconnecting exchanges exactly what each side is missing.
//
// status : 'connecting' | 'connected' | 'offline' | 'denied' (no access / not found) | 'deleted'
// everSynced : the first sync happened. Before that the local copy is empty, so it must not be edited yet.
export class SocketIOProvider {
    constructor({ workspaceId, documentId, doc, onChange }) {
        this.workspaceId = workspaceId;
        this.documentId = documentId;
        this.doc = doc;
        this.awareness = new Awareness(doc);
        this.onChange = onChange;
        this.socket = null;
        this.destroyed = false;

        this.state = {
            status: "connecting",
            synced: false,
            everSynced: false,
            canEdit: false,
            message: null,
            unsyncedChanges: false
        };

        // local edits go to the server, but only while we are connected AND have finished the join handshake.
        // Edits made before that are not lost : the handshake sends the server everything it is missing.
        this.doc.on("update", this.handleLocalUpdate);
        this.awareness.on("update", this.handleLocalAwareness);
    }

    setState(changes) {
        this.state = { ...this.state, ...changes };
        this.onChange?.(this.state);
    }

    connect() {
        // same origin as the page (the dev server forwards /socket.io to the backend). The login cookie travels with it.
        this.socket = io({ transports: ["websocket"], withCredentials: true });

        this.socket.on("connect", this.join);
        this.socket.on("doc:sync", this.handleSync);
        this.socket.on("doc:update", ({ update })=> Y.applyUpdate(this.doc, new Uint8Array(update), this));
        this.socket.on("doc:awareness", ({ update }) =>
            applyAwarenessUpdate(this.awareness, new Uint8Array(update), this)
        );
        this.socket.on("doc:error", this.handleServerError);
        this.socket.on("disconnect", this.handleDisconnect);
        this.socket.on("connect_error", (error)=>{
            // "Unauthorized" = not logged in (any more): trying again will not help. Anything else is a network problem.
            if(error.message === "Unauthorized"){
                this.setState({ status: "denied", message: "You are not logged in." });
                this.socket.disconnect();
            } else {
                this.setState({ status: "offline" });
            }
        });
    }

    // step 1 of the handshake. Runs on the first connection AND after every reconnection (a new connection = a new join).
    join = ()=>{
        this.setState({ synced: false });

        this.socket.emit(
            "doc:join",
            { workspaceId: this.workspaceId, documentId: this.documentId, stateVector: Y.encodeStateVector(this.doc) },
            (answer)=>{
                if(!answer?.ok){
                    // not a member, no such document, ... the server gives the same answer for all of them
                    this.setState({
                        status: "denied",
                        message: "This document does not exist, or you cannot open it."
                    });
                    this.socket.disconnect();
                    return;
                }
                this.setState({ canEdit: answer.canEdit });
            }
        );
    };

    // steps 2 and 3
    handleSync = ({ update, stateVector })=>{
        Y.applyUpdate(this.doc, new Uint8Array(update), this);

        // send the server what IT is missing, for example everything typed while offline
        const missing = Y.encodeStateAsUpdate(this.doc, new Uint8Array(stateVector));
        if(missing.length > 2){
            this.socket.emit("doc:update", { update: missing });
        }

        // from now on live edits flow both ways, and the others learn where we are
        this.setState({ status: "connected", synced: true, everSynced: true, unsyncedChanges: false, message: null });
        if(this.awareness.getLocalState() !== null){
            this.socket.emit("doc:awareness", { update: encodeAwarenessUpdate(this.awareness, [this.doc.clientID]) });
        }
    };

    handleLocalUpdate = (update, origin)=>{
        if(origin === this) return; // it came FROM the server, do not send it back

        if(this.socket?.connected && this.state.synced){
            this.socket.emit("doc:update", { update });
        } else {
            this.setState({ unsyncedChanges: true }); // it will be sent by the next handshake
        }
    };

    handleLocalAwareness = ({ added, updated, removed }, origin)=>{
        if(origin === "local" && this.socket?.connected && this.state.synced){
            this.socket.emit("doc:awareness", {
                update: encodeAwarenessUpdate(this.awareness, added.concat(updated, removed))
            });
        }
    };

    handleServerError = ({ code, message })=>{
        if(code === "ACCESS_REVOKED"){
            this.setState({ status: "denied", message });
            this.socket.disconnect();
        } else if(code === "DOCUMENT_DELETED"){
            this.setState({ status: "deleted", message });
            this.socket.disconnect();
        } else if(code === "READ_ONLY"){
            // your role changed to VIEWER while the document was open
            this.setState({ canEdit: false, message });
        } else {
            this.setState({ message });
        }
    };

    handleDisconnect = ()=>{
        // other people's cursors would be frozen : remove them until we are back
        const others = [...this.awareness.getStates().keys()].filter((id)=> id !== this.doc.clientID);
        removeAwarenessStates(this.awareness, others, "offline");

        if(!this.destroyed && !["denied", "deleted"].includes(this.state.status)){
            // Socket.IO tries to reconnect by itself, with growing pauses
            this.setState({ status: "offline", synced: false });
        }
    };

    destroy() {
        this.destroyed = true;
        this.doc.off("update", this.handleLocalUpdate);
        this.awareness.off("update", this.handleLocalAwareness);
        removeAwarenessStates(this.awareness, [this.doc.clientID], "closed");

        if(this.socket){
            this.socket.emit("doc:leave");
            this.socket.disconnect();
        }
        this.awareness.destroy();
    }
}
