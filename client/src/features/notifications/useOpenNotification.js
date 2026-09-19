import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "./NotificationsContext";
import { notificationLink } from "./notificationsState";

// What happens when a notification is clicked : it is marked as read, and the user is taken to its source.
// Going there does not wait for the marking : a slow answer or a failure must never keep somebody from reading the message.
export const useOpenNotification = (afterOpen)=>{
    const { markRead } = useNotifications();
    const navigate = useNavigate();

    return useCallback((notification)=>{
        if(!notification.read) markRead(notification.id).catch(()=>{});
        navigate(notificationLink(notification));
        afterOpen?.();
    }, [markRead, navigate, afterOpen]);
}
