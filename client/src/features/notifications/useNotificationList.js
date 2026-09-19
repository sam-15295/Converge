import { useCallback, useEffect, useReducer, useRef } from "react";
import { getNotifications } from "./notificationsApi";
import { initialListState, listReducer } from "./notificationsState";
import { useNotifications } from "./NotificationsContext";

// One list of notifications (the bell's dropdown, or the inbox page) : loads the first page, loads older ones on demand,
// and stays up to date with what the server pushes. Give it a `key` that changes with `onlyUnread`, so a different filter
// starts from a clean list.
export const useNotificationList = ({ onlyUnread = false, limit = 20 } = {})=>{
    const { subscribe } = useNotifications();
    const [state, dispatch] = useReducer(listReducer, initialListState);

    // callbacks live longer than one render, so they read the newest state from here
    const latest = useRef(state);
    useEffect(()=>{
        latest.current = state;
    });

    const unread = onlyUnread ? "true" : undefined;

    const load = useCallback(async (signal)=>{
        try{
            const { notifications, hasMore } = await getNotifications({ limit, unread }, signal);
            dispatch({ type: "loaded", items: notifications, hasMore });
        }
        catch(err){
            if(err.name !== "AbortError") dispatch({ type: "problem", message: `Could not load the notifications : ${err.message}` });
        }
    }, [limit, unread]);

    useEffect(()=>{
        const controller = new AbortController();
        load(controller.signal);
        return ()=> controller.abort();
    }, [load]);

    // live changes
    useEffect(()=>{
        return subscribe((event)=>{
            if(event.type === "new") dispatch({ type: "received", notification: event.notification });
            else if(event.type === "read") dispatch({ type: "read", notificationId: event.notificationId, onlyUnread });
            else if(event.type === "allRead") dispatch({ type: "allRead", onlyUnread });
            // something we cannot patch in : read the first page again (after being offline, or after leaving a workspace)
            else if(event.type === "reconnected" || event.type === "count") load();
        });
    }, [subscribe, onlyUnread, load]);

    const loadMore = useCallback(async ()=>{
        const oldest = latest.current.items.at(-1);
        if(!oldest) return;

        try{
            const { notifications, hasMore } = await getNotifications({ limit, unread, before: oldest.id });
            dispatch({ type: "more", items: notifications, hasMore });
        }
        catch(err){
            dispatch({ type: "problem", message: `Could not load more : ${err.message}` });
        }
    }, [limit, unread]);

    return { ...state, loadMore, reload: ()=> load() };
}
