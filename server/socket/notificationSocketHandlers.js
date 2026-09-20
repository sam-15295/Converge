import appEvents from "../events/appEvents.js";
import {countUnread} from "../service/notificationService.js";
import {isRedisEnabled} from "../config/redis.js";

// The real-time side of notifications : the server PUSHES a new notification (and every change of the unread count) to
// the tabs of the person it belongs to, so the bell updates without asking.
//
// Everything is saved by the REST API and the listener of events/notificationListeners.js. This file only delivers what
// the event bus announces, like the chat does.
//
// browser -> server                         server -> browser (only to that person's own tabs)
//   notifications:join (+ ack)                notification:new {notification, unreadCount}     somebody mentioned you
//                                             notification:updated {notificationId, read, unreadCount}   one was read (maybe in another tab)
//                                             notification:all-read {unreadCount}              "mark all as read" in another tab
//                                             notification:unread-count {unreadCount}          the count changed for another reason
//                                                                                              (you left a workspace)
//
// The ack of notifications:join says how many are unread right now.

const joinsPer10Seconds = 10;      // a tab joins once, more than this is not a person

// one private room per person. The name comes from the login of the connection, never from what the browser sends,
// so nobody can listen to somebody else's notifications.
const userRoom = (userId)=> `user:${userId}`;

const attachNotificationHandlers = (io)=>{
    const onJoin = async (socket, ack)=>{
        const reply = typeof ack === "function" ? ack : ()=>{};

        try{
            // flood protection
            const now = Date.now();
            const window = socket.data.notificationJoinWindow ?? (socket.data.notificationJoinWindow = {start : now, count : 0});
            if(now - window.start > 10000){
                window.start = now;
                window.count = 0;
            }
            if(++window.count > joinsPer10Seconds){
                socket.disconnect(true);
                return;
            }

            // Join FIRST, count second : anything that arrives while counting is pushed to this tab, so no notification
            // can fall in the gap. (If the tab closes during the count, the room is cleaned up by the disconnect itself.)
            socket.join(userRoom(socket.data.user.id));

            reply({ok : true, unreadCount : await countUnread(socket.data.user.id)});
        }
        catch(err){
            console.log(err);
            reply({ok : false, error : "Something went wrong"});
        }
    }

    io.on("connection", (socket)=>{
        socket.on("notifications:join", (payload, ack)=> onJoin(socket, typeof payload === "function" ? payload : ack));
    });

    // ---------- delivering what happened elsewhere in the app ----------

    const onCreated = ({recipientId, notification, unreadCount})=>{
        io.to(userRoom(recipientId)).emit("notification:new", {notification, unreadCount});
    }

    const onRead = ({recipientId, notificationId, unreadCount})=>{
        io.to(userRoom(recipientId)).emit("notification:updated", {notificationId, read : true, unreadCount});
    }

    const onReadAll = ({recipientId, unreadCount})=>{
        io.to(userRoom(recipientId)).emit("notification:all-read", {unreadCount});
    }

    // The number on somebody's bell changed for a reason that is not a new or a read notification : they left a workspace
    // (its notifications are hidden), or a comment they were notified about was deleted.
    // Nothing is asked from the database when the person has no tab listening. Only valid while this is the only
    // server : with several, their tab may be listening on another one (see commentSocketHandlers for the same rule).
    const pushCount = async (userId)=>{
        try{
            if(!isRedisEnabled() && !io.sockets.adapter.rooms.has(userRoom(userId))){
                return;
            }
            io.to(userRoom(userId)).emit("notification:unread-count", {unreadCount : await countUnread(userId)});
        }
        catch(err){
            console.log(err);
        }
    }

    const onMembershipChanged = ({userId})=> pushCount(userId);
    const onRecount = ({recipientId})=> pushCount(recipientId);

    appEvents.on("notification:created", onCreated);
    appEvents.on("notification:read", onRead);
    appEvents.on("notification:read-all", onReadAll);
    appEvents.on("membership:changed", onMembershipChanged);
    appEvents.on("notification:recount", onRecount);

    // used when the server stops (and by tests) so listeners are not added twice
    return ()=>{
        appEvents.off("notification:created", onCreated);
        appEvents.off("notification:read", onRead);
        appEvents.off("notification:read-all", onReadAll);
        appEvents.off("membership:changed", onMembershipChanged);
        appEvents.off("notification:recount", onRecount);
    };
}

export default attachNotificationHandlers;
