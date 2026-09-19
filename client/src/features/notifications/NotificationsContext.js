import { createContext, useContext } from "react";

// The context object plus the hook components use to read it.
// The provider that fills it in lives in NotificationsProvider.jsx.
//
//   unreadCount   the number on the bell (kept up to date by the server, also across tabs)
//   status        "connecting" | "connected" | "offline"
//   markRead(id)  mark one notification as read
//   markAllRead() mark all of them
//   subscribe(fn) fn({ type }) is called for what happens live : "new" (with .notification), "read" (.notificationId),
//                 "allRead", "count" (the count changed for another reason) and "joined" (the live connection joined, after
//                 the first connection or a reconnection : the lists read themselves again).
//                 Returns a function that stops listening. The lists (bell, inbox page) use it to stay up to date.
export const NotificationsContext = createContext(null);

export const useNotifications = ()=>{
    const value = useContext(NotificationsContext);
    if(!value) throw new Error("useNotifications must be used inside <NotificationsProvider>");
    return value;
}
