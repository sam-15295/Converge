import { apiRequest } from "../../services/api";
import { withQuery } from "../../utils/withQuery";

// One function per notification endpoint. Each returns the JSON body; errors are thrown as ApiClientError.
// The notifications are MINE : there is no workspace in these URLs, the server decides what I may see.

// newest first. params : { limit, before (id of the last one I have), unread: "true", workspaceId }
export const getNotifications = (params, signal)=> apiRequest(withQuery("/notifications", params), { signal });

export const getUnreadCount = (signal)=> apiRequest("/notifications/unread-count", { signal });

export const markNotificationRead = (notificationId)=>
    apiRequest(`/notifications/${notificationId}/read`, { method: "PATCH" });

export const markAllNotificationsRead = ()=> apiRequest("/notifications/read-all", { method: "POST" });
