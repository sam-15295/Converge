import WorkspaceMember from "../model/workspaceMemberSchema.js";
import Document from "../model/documentSchema.js";
import {can} from "../config/permissions.js";
import appEvents from "../events/appEvents.js";
import {countOpenThreads} from "../service/commentService.js";

// The real-time side of the comments of a document.
//
// Comments are WRITTEN through the REST API (one place for validation, permissions and rate limiting). The controllers
// announce what happened on the event bus, and this file pushes it to everybody who has the comments of that document open.
// So the sockets never save anything, they only deliver.
//
// browser -> server                              server -> browser
//   comments:join {workspaceId, documentId}        comment:new {comment, openCount}          a comment or a reply was written
//   (+ ack)                                        comment:updated {thread, openCount}       a thread was resolved or reopened
//                                                  comment:removed {commentId, parentCommentId, openCount}   a thread (parent null) or a reply is gone
//                                                  comment:access {canComment}               your role changed, you may still read
//                                                  comment:error {code, message}             ACCESS_REVOKED | DOCUMENT_DELETED | WORKSPACE_DELETED
//
// Every push carries openCount, the number of threads still open, worked out by the SERVER (the number on the comments
// button), so tabs never drift by counting on their own.
// The ack of comments:join says whether it worked and whether you may write.

const joinsPer10Seconds = 10;      // opening the comments is rare, more than this is not a person

const commentsRoom = (documentId)=> `comments:${documentId}`;

// Only a plain 24 character id is accepted, written the one way (lower case) we use everywhere. (No objects, numbers or
// odd strings that a database driver could still turn into an id.)
const cleanId = (value)=> typeof value === "string" && /^[a-f0-9]{24}$/i.test(value) ? value.toLowerCase() : null;

// the membership of this person, but only if their role may read comments and the document belongs to the workspace
const allowedMembership = async (workspaceId, documentId, userId)=>{
    const membership = await WorkspaceMember.findOne({workspaceId, userId});

    if(!membership || !can(membership.role, "comment:view")){
        return null;
    }
    if(!(await Document.exists({_id : documentId, workspaceId}))){
        return null;
    }
    return membership;
}

const attachCommentHandlers = (io)=>{
    // ---------- joining and leaving ----------

    const leaveComments = (socket)=>{
        const current = socket.data.comments;

        if(!current){
            return;
        }
        socket.data.comments = null;
        socket.leave(commentsRoom(current.documentId));
    }

    const onJoin = async (socket, payload, ack)=>{
        const reply = typeof ack === "function" ? ack : ()=>{};
        const notFound = {ok : false, error : "Document not found"};

        try{
            // flood protection
            const now = Date.now();
            const window = socket.data.commentJoinWindow ?? (socket.data.commentJoinWindow = {start : now, count : 0});
            if(now - window.start > 10000){
                window.start = now;
                window.count = 0;
            }
            if(++window.count > joinsPer10Seconds){
                socket.disconnect(true);
                return;
            }

            // Not a member, no such document, no permission : the same answer for all, so nothing is revealed to outsiders
            const workspaceId = cleanId(payload?.workspaceId);
            const documentId = cleanId(payload?.documentId);
            const userId = socket.data.user.id;

            if(!workspaceId || !documentId){
                return reply(notFound);
            }

            const membership = await allowedMembership(workspaceId, documentId, userId);

            if(!membership){
                return reply(notFound);
            }

            // The tab was closed while we were checking : there is nobody to register (Socket.IO ignores join() on a closed
            // socket anyway), so stop here instead of asking the database a second time
            if(!socket.connected){
                return;
            }

            // the same document again changes nothing
            if(socket.data.comments?.documentId !== documentId){
                leaveComments(socket);      // one document per connection

                socket.join(commentsRoom(documentId));
                socket.data.comments = {workspaceId, documentId};

                // If the person was removed while we were checking above, the removal found nobody to remove (we were not
                // registered yet). Now that we are registered, ask once more.
                if(!(await allowedMembership(workspaceId, documentId, userId))){
                    leaveComments(socket);
                    return reply(notFound);
                }
            }

            reply({ok : true, canComment : can(membership.role, "comment:create")});
        }
        catch(err){
            console.log(err);
            reply({ok : false, error : "Something went wrong"});
        }
    }

    io.on("connection", (socket)=>{
        socket.on("comments:join", (payload, ack)=> onJoin(socket, payload, ack));
        socket.on("comments:leave", ()=> leaveComments(socket));
        socket.on("disconnect", ()=> leaveComments(socket));
    });

    // ---------- delivering what happened elsewhere in the app ----------

    // Sends an event to everybody who has the comments of the document open, with the number of open threads.
    // Nothing is asked from the database when nobody is listening.
    const pushToRoom = async (documentId, event, payload)=>{
        try{
            if(!io.sockets.adapter.rooms.has(commentsRoom(documentId))){
                return;
            }
            io.to(commentsRoom(documentId)).emit(event, {...payload, openCount : await countOpenThreads(documentId)});
        }
        catch(err){
            console.log(err);
        }
    }

    const onCreated = ({documentId, comment})=> pushToRoom(documentId, "comment:new", {comment});

    const onUpdated = ({documentId, thread})=> pushToRoom(documentId, "comment:updated", {thread});

    // parentCommentId null : the whole thread is gone. Otherwise only that reply.
    const onDeleted = ({documentId, commentId, parentCommentId})=> pushToRoom(documentId, "comment:removed", {commentId, parentCommentId});

    // the tabs of one workspace that have the comments of some document open (optionally only one person's)
    const commentSockets = (predicate)=>{
        return [...io.sockets.sockets.values()].filter((socket)=> socket.data.comments && predicate(socket.data.comments, socket));
    }

    // someone was removed, left, or got another role : do they still have the right to read these comments?
    const onMembershipChanged = async ({workspaceId, userId})=>{
        try{
            const sockets = commentSockets((current, socket)=> current.workspaceId === String(workspaceId) && socket.data.user.id === String(userId));

            for(const socket of sockets){
                const current = socket.data.comments;
                const membership = current ? await allowedMembership(current.workspaceId, current.documentId, socket.data.user.id) : null;

                if(!current){
                    continue;
                }
                if(membership){
                    socket.emit("comment:access", {canComment : can(membership.role, "comment:create")});
                }
                else{
                    socket.emit("comment:error", {code : "ACCESS_REVOKED", message : "You no longer have access to these comments"});
                    leaveComments(socket);
                }
            }
        }
        catch(err){
            console.log(err);
        }
    }

    const closeFor = (predicate, code, message)=>{
        for(const socket of commentSockets(predicate)){
            socket.emit("comment:error", {code, message});
            leaveComments(socket);
        }
    }

    const onDocumentDeleted = ({documentId})=>{
        closeFor((current)=> current.documentId === String(documentId), "DOCUMENT_DELETED", "This document was deleted");
    }

    const onWorkspaceDeleted = ({workspaceId})=>{
        closeFor((current)=> current.workspaceId === String(workspaceId), "WORKSPACE_DELETED", "This workspace was deleted");
    }

    appEvents.on("comment:created", onCreated);
    appEvents.on("comment:updated", onUpdated);
    appEvents.on("comment:deleted", onDeleted);
    appEvents.on("membership:changed", onMembershipChanged);
    appEvents.on("document:deleted", onDocumentDeleted);
    appEvents.on("workspace:deleted", onWorkspaceDeleted);

    // used when the server stops (and by tests) so listeners are not added twice
    return ()=>{
        appEvents.off("comment:created", onCreated);
        appEvents.off("comment:updated", onUpdated);
        appEvents.off("comment:deleted", onDeleted);
        appEvents.off("membership:changed", onMembershipChanged);
        appEvents.off("document:deleted", onDocumentDeleted);
        appEvents.off("workspace:deleted", onWorkspaceDeleted);
    };
}

export default attachCommentHandlers;
