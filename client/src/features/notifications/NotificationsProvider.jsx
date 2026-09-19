import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { NotificationsContext } from "./NotificationsContext";
import { markAllNotificationsRead, markNotificationRead } from "./notificationsApi";

// Holds what the whole app needs to know about notifications : the number on the bell, and the live connection that
// keeps it right. There is ONE connection per open tab, however many places show notifications.
//
// The server pushes (see server/socket/notificationSocketHandlers.js) :
//   notification:new        somebody mentioned you           -> the count changes, lists add it
//   notification:updated    one was read (maybe in another tab) -> the count changes, lists mark it
//   notification:all-read   all were read                    -> the same
//   notification:unread-count  the count changed for another reason (you left a workspace)
// Every push carries the count the SERVER worked out, so the number never depends on counting here.
const NotificationsProvider = ({ children })=>{
    const [unreadCount, setUnreadCount] = useState(0);
    const [status, setStatus] = useState("connecting");
    const listeners = useRef(new Set());

    const subscribe = useCallback((listener)=>{
        listeners.current.add(listener);
        return ()=> listeners.current.delete(listener);
    }, []);

    const tell = useCallback((event)=>{
        listeners.current.forEach((listener)=> listener(event));
    }, []);

    useEffect(()=>{
        let stopped = false; // this effect was cleaned up (logged out / left the app)
        let connectedBefore = false;

        // same origin as the page (the dev server forwards /socket.io to the backend). The login cookie travels with it.
        const socket = io({ transports: ["websocket"], withCredentials: true });

        // Runs on the first connection AND after every reconnection : a new connection has to join again
        socket.on("connect", ()=>{
            socket.emit("notifications:join", {}, (answer)=>{
                if(stopped) return;
                if(!answer?.ok){
                    setStatus("offline");
                    return;
                }
                setUnreadCount(answer.unreadCount);
                setStatus("connected");

                // after a lost connection the lists may have missed something : they read themselves again
                if(connectedBefore) tell({ type: "reconnected" });
                connectedBefore = true;
            });
        });

        socket.on("notification:new", ({ notification, unreadCount: count })=>{
            setUnreadCount(count);
            tell({ type: "new", notification });
        });
        socket.on("notification:updated", ({ notificationId, unreadCount: count })=>{
            setUnreadCount(count);
            tell({ type: "read", notificationId });
        });
        socket.on("notification:all-read", ({ unreadCount: count })=>{
            setUnreadCount(count);
            tell({ type: "allRead" });
        });
        socket.on("notification:unread-count", ({ unreadCount: count })=>{
            setUnreadCount(count);
            tell({ type: "count" });
        });

        socket.on("disconnect", ()=>{
            if(!stopped) setStatus("offline");
        });
        socket.on("connect_error", ()=>{
            if(!stopped) setStatus("offline");
        });

        return ()=>{
            stopped = true;
            socket.disconnect();
        };
    }, [tell]);

    // The answer of the server has the new count, and the lists are told at once (the push that follows repeats it, harmlessly)
    const markRead = useCallback(async (notificationId)=>{
        const answer = await markNotificationRead(notificationId);
        setUnreadCount(answer.unreadCount);
        tell({ type: "read", notificationId });
    }, [tell]);

    const markAllRead = useCallback(async ()=>{
        const answer = await markAllNotificationsRead();
        setUnreadCount(answer.unreadCount);
        tell({ type: "allRead" });
    }, [tell]);

    const value = useMemo(
        ()=> ({ unreadCount, status, markRead, markAllRead, subscribe }),
        [unreadCount, status, markRead, markAllRead, subscribe]
    );

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export default NotificationsProvider;
