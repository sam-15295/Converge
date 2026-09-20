import WorkspaceMember from "../model/workspaceMemberSchema.js";
import {can} from "../config/permissions.js";
import appEvents from "../events/appEvents.js";
import {addPresence, removePresence, onlineUserIds, localSocketIdsIn} from "../service/presenceService.js";

// The real-time side of the workspace chat.
//
// Messages are WRITTEN through the REST API (one place for validation, permissions and rate limiting). The controllers
// announce what happened on the event bus, and this file pushes it to everybody who has that workspace's chat open.
// So the sockets never save anything, they only deliver.
//
// browser -> server                       server -> browser
//   chat:join {workspaceId} (+ ack)         chat:message {chatMessage}          a new message or reply
//   chat:leave                              chat:message-updated {chatMessage}  new reactions / reply count
//                                           presence:update {userId, online}    somebody came or left
//                                           chat:access {canSend}               your role changed, you may still read
//                                           chat:error {code, message}          ACCESS_REVOKED | WORKSPACE_DELETED
//
// The ack of chat:join says whether it worked, whether you may send, and who is online right now.

const joinsPer10Seconds = 10;      // joining is rare (opening the chat), more than this is not a person

const chatRoom = (workspaceId)=> `chat:${workspaceId}`;

// Only a plain 24 character id is accepted, written the one way (lower case) we use everywhere as room and presence key.
// (No objects, numbers or odd strings that a database driver could still turn into an id.)
const cleanId = (value)=> typeof value === "string" && /^[a-f0-9]{24}$/i.test(value) ? value.toLowerCase() : null;

// the membership of this person, but only if their role may read the chat
const allowedMembership = async (workspaceId, userId)=>{
    const membership = await WorkspaceMember.findOne({workspaceId, userId});
    return membership && can(membership.role, "chat:view") ? membership : null;
}

const attachChatHandlers = (io)=>{
    // ---------- joining and leaving ----------

    // announce = false : leave without telling the others (used when they never heard that this person arrived)
    const leaveChat = async (socket, announce = true)=>{
        const current = socket.data.chat;

        if(!current){
            return;
        }
        socket.data.chat = null;
        socket.leave(chatRoom(current.workspaceId));

        // Only when this was the person's last socket in the workspace ON ANY SERVER do the others hear that they
        // went offline : another tab of theirs may be connected somewhere else.
        if(await removePresence(current.workspaceId, socket.data.user.id, socket.id) && announce){
            io.to(chatRoom(current.workspaceId)).emit("presence:update", {userId : socket.data.user.id, online : false});
        }
    }

    const onJoin = async (socket, payload, ack)=>{
        const reply = typeof ack === "function" ? ack : ()=>{};
        const notFound = {ok : false, error : "Workspace not found"};

        try{
            // flood protection : opening the chat is rare
            const now = Date.now();
            const window = socket.data.joinWindow ?? (socket.data.joinWindow = {start : now, count : 0});
            if(now - window.start > 10000){
                window.start = now;
                window.count = 0;
            }
            if(++window.count > joinsPer10Seconds){
                socket.disconnect(true);
                return;
            }

            // Not a member, not a valid id, no permission : the same answer for all, so nothing is revealed to outsiders
            const workspaceId = cleanId(payload?.workspaceId);
            const userId = socket.data.user.id;

            if(!workspaceId){
                return reply(notFound);
            }

            const membership = await allowedMembership(workspaceId, userId);

            if(!membership){
                return reply(notFound);
            }

            // The tab was closed while we were checking. Registering it now would leave a "ghost" online for ever,
            // because its disconnect has already been handled.
            if(!socket.connected){
                return;
            }

            // opening the same chat again (a repeated join) changes nothing, so nobody sees the person flicker offline and online
            if(socket.data.chat?.workspaceId !== workspaceId){
                await leaveChat(socket);     // one workspace chat per connection, and it must finish before the new join

                socket.join(chatRoom(workspaceId));
                socket.data.chat = {workspaceId};
                const cameOnline = await addPresence(workspaceId, userId, socket.id);

                // If the person was removed while we were checking above, the removal found nobody to remove (we were not
                // registered yet) and would never be noticed. Now that we are registered, ask once more.
                if(!(await allowedMembership(workspaceId, userId))){
                    await leaveChat(socket, false);
                    return reply(notFound);
                }

                // the others hear it (the person who just arrived gets the list of who is online in the answer instead)
                if(cameOnline){
                    socket.to(chatRoom(workspaceId)).emit("presence:update", {userId, online : true});
                }
            }

            reply({
                ok : true,
                canSend : can(membership.role, "chat:send"),
                onlineUserIds : await onlineUserIds(workspaceId)
            });
        }
        catch(err){
            console.log(err);
            reply({ok : false, error : "Something went wrong"});
        }
    }

    const onConnection = (socket)=>{
        socket.on("chat:join", (payload, ack)=> onJoin(socket, payload, ack));
        socket.on("chat:leave", ()=> leaveChat(socket).catch((err)=> console.log(err)));
        socket.on("disconnect", ()=> leaveChat(socket).catch((err)=> console.log(err)));
    }

    io.on("connection", onConnection);

    // ---------- delivering what happened elsewhere in the app ----------

    // Everybody who has this workspace's chat open gets it, including the sender's own sockets
    // (the browser ignores a message it already has, it recognises it by its id).
    const onMessageCreated = ({workspaceId, chatMessage})=>{
        io.to(chatRoom(workspaceId)).emit("chat:message", {chatMessage});
    }

    const onMessageUpdated = ({workspaceId, chatMessage})=>{
        io.to(chatRoom(workspaceId)).emit("chat:message-updated", {chatMessage});
    }

    // Someone was removed, left, or got another role : do they still have the right to read this chat?
    const onMembershipChanged = async ({workspaceId, userId})=>{
        try{
            // only this server's sockets : the other servers handle their own (see the distributed events)
            const socketIds = localSocketIdsIn(workspaceId, userId);

            if(socketIds.length === 0){
                return;
            }

            // one question for all of this person's tabs
            const membership = await allowedMembership(workspaceId, userId);

            for(const socketId of socketIds){
                const socket = io.sockets.sockets.get(socketId);

                if(!socket){
                    continue;
                }
                if(membership){
                    socket.emit("chat:access", {canSend : can(membership.role, "chat:send")});
                }
                else{
                    socket.emit("chat:error", {code : "ACCESS_REVOKED", message : "You no longer have access to this chat"});
                    await leaveChat(socket);
                }
            }
        }
        catch(err){
            console.log(err);
        }
    }

    const onWorkspaceDeleted = async ({workspaceId})=>{
        for(const socketId of localSocketIdsIn(workspaceId)){
            const socket = io.sockets.sockets.get(socketId);

            if(socket){
                socket.emit("chat:error", {code : "WORKSPACE_DELETED", message : "This workspace was deleted"});
                await leaveChat(socket);
            }
        }
    }

    appEvents.on("message:created", onMessageCreated);
    appEvents.on("message:updated", onMessageUpdated);
    appEvents.on("membership:changed", onMembershipChanged);
    appEvents.on("workspace:deleted", onWorkspaceDeleted);

    // used when the server stops (and by tests) so listeners are not added twice
    return ()=>{
        appEvents.off("message:created", onMessageCreated);
        appEvents.off("message:updated", onMessageUpdated);
        appEvents.off("membership:changed", onMembershipChanged);
        appEvents.off("workspace:deleted", onWorkspaceDeleted);
    };
}

export default attachChatHandlers;
