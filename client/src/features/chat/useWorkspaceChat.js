import { useCallback, useEffect, useReducer, useRef } from "react";
import { io } from "socket.io-client";
import { addReaction, getMessages, getReplies, removeReaction, sendMessage } from "./chatApi";
import { chatReducer, initialChatState } from "./chatState";

const pageSize = 30;

// Everything one open workspace chat needs, in one place :
//   - the live connection (Socket.IO) : new messages, reactions and who is online arrive by themselves
//   - the history (REST) : the newest messages first, older ones when the user scrolls up
//   - the actions : send, react, open a thread
//
// Messages are WRITTEN with the REST API (one place for validation and permissions) and READ live from the socket.
// So after sending, the answer of the REST call and the same message coming back over the socket both arrive :
// the reducer recognises it by its id and shows it once.
export const useWorkspaceChat = (workspaceId, userId)=>{
    const [state, dispatch] = useReducer(chatReducer, initialChatState);

    // The socket callbacks live for a long time, so they read the newest state from here, not from the render they were created in
    const latest = useRef(state);
    useEffect(()=>{
        latest.current = state;
    });

    // After a lost connection, the newest message we HAD (so we can tell whether the history we fetch now connects to it).
    //   null       nothing loaded yet
    //   undefined  we are up to date
    //   an id      we were disconnected after that message
    const resumeAfter = useRef(null);

    // ---------- history ----------

    // The first page, and also what happens after a reconnection : the latest page again. It refreshes the recent
    // messages too (someone may have reacted meanwhile). If we missed more than a page, it does not connect to what
    // we have, so we start again from it (the older messages are one scroll away).
    const loadLatest = useCallback(async ()=>{
        try{
            const { messages, hasMore } = await getMessages(workspaceId, { limit: pageSize });
            const cursor = resumeAfter.current;
            const connects = !hasMore || messages.some((message)=> message.id === cursor);
            const mode = !cursor ? "latest" : connects ? "newer" : "replace";

            dispatch({ type: "history", mode, messages, hasMore });
            resumeAfter.current = undefined;
        }
        catch(err){
            dispatch({ type: "problem", message: `Could not load the messages : ${err.message}` });
        }
    }, [workspaceId]);

    const loadOlder = useCallback(async ()=>{
        const oldest = latest.current.messages[0];
        if(!oldest) return;

        try{
            const { messages, hasMore } = await getMessages(workspaceId, { before: oldest.id, limit: pageSize });
            dispatch({ type: "history", mode: "older", messages, hasMore });
        }
        catch(err){
            dispatch({ type: "problem", message: `Could not load older messages : ${err.message}` });
        }
    }, [workspaceId]);

    // ---------- threads ----------

    const openThread = useCallback(async (parentId)=>{
        dispatch({ type: "openThread", parentId });

        try{
            const { messages, hasMore } = await getReplies(workspaceId, parentId, { limit: pageSize });
            dispatch({ type: "threadHistory", parentId, mode: "latest", messages, hasMore });
        }
        catch(err){
            dispatch({ type: "problem", message: `Could not load the replies : ${err.message}` });
        }
    }, [workspaceId]);

    const closeThread = useCallback(()=> dispatch({ type: "closeThread" }), []);

    const loadOlderReplies = useCallback(async ()=>{
        const open = latest.current.thread;
        const oldest = open?.messages[0];
        if(!oldest) return;

        try{
            const { messages, hasMore } = await getReplies(workspaceId, open.parentId, { before: oldest.id, limit: pageSize });
            dispatch({ type: "threadHistory", parentId: open.parentId, mode: "older", messages, hasMore });
        }
        catch(err){
            dispatch({ type: "problem", message: `Could not load older replies : ${err.message}` });
        }
    }, [workspaceId]);

    // after a reconnection the open thread may have missed replies : read its latest page again
    const refreshThread = useCallback(async ()=>{
        const open = latest.current.thread;
        if(!open) return;

        try{
            const { messages, hasMore } = await getReplies(workspaceId, open.parentId, { limit: pageSize });
            dispatch({ type: "threadHistory", parentId: open.parentId, mode: "replace", messages, hasMore });
        }
        catch(err){
            dispatch({ type: "problem", message: `Could not refresh the replies : ${err.message}` });
        }
    }, [workspaceId]);

    // ---------- the connection ----------

    useEffect(()=>{
        let stopped = false; // this effect was cleaned up (left the page / other workspace)
        let closedForGood = false; // the server said "no" : reconnecting would not help
        let retryTimer = null;

        // same origin as the page (the dev server forwards /socket.io to the backend). The login cookie travels with it.
        const socket = io({ transports: ["websocket"], withCredentials: true });

        const closeForGood = (notice)=>{
            closedForGood = true;
            dispatch({ type: "status", status: "denied", notice });
            socket.disconnect();
        }

        // Runs on the first connection AND after every reconnection : a new connection has to open the chat again.
        // Order matters : join FIRST, so live messages start flowing, and only then read the history. A message sent
        // between the two shows up in both and is shown once. The other way round, it could fall in the gap.
        socket.on("connect", ()=>{
            socket.emit("chat:join", { workspaceId }, (answer)=>{
                if(!answer?.ok){
                    closeForGood("This workspace does not exist, or you cannot open its chat.");
                    return;
                }
                dispatch({ type: "access", canSend: answer.canSend });
                dispatch({ type: "presenceList", userIds: answer.onlineUserIds });
                dispatch({ type: "status", status: "connected" });
                loadLatest();
                refreshThread();
            });
        });

        socket.on("chat:message", ({ chatMessage })=> dispatch({ type: "received", chatMessage }));
        socket.on("chat:message-updated", ({ chatMessage })=> dispatch({ type: "updated", chatMessage }));
        socket.on("presence:update", ({ userId: who, online })=> dispatch({ type: "presence", userId: who, online }));
        socket.on("chat:access", ({ canSend })=> dispatch({ type: "access", canSend }));
        socket.on("chat:error", ({ message })=> closeForGood(message));

        socket.on("disconnect", (reason)=>{
            if(stopped || closedForGood) return;

            // remember where we were, so the next connection can fill in what was missed
            if(resumeAfter.current === undefined){
                resumeAfter.current = latest.current.messages.at(-1)?.id ?? null;
            }
            dispatch({ type: "status", status: "offline" });
            dispatch({ type: "presenceList", userIds: [] }); // nobody's status is known while we are not connected

            // Socket.IO reconnects by itself after a lost connection, but not when the SERVER closed it
            if(reason === "io server disconnect"){
                retryTimer = setTimeout(()=> socket.connect(), 1000);
            }
        });

        socket.on("connect_error", (error)=>{
            // "Unauthorized" = not logged in (any more) : trying again will not help. Anything else is a network problem.
            if(error.message === "Unauthorized"){
                closeForGood("You are not logged in.");
            } else {
                dispatch({ type: "status", status: "offline" });
            }
        });

        return ()=>{
            stopped = true;
            clearTimeout(retryTimer);
            socket.disconnect();
        };
    }, [workspaceId, loadLatest, refreshThread]);

    // ---------- actions ----------

    // Sends a message (or a reply). A failure is thrown, so the composer can show it and keep the text.
    const send = useCallback(async (content, parentMessageId)=>{
        const { chatMessage, parent } = await sendMessage(workspaceId, { content, parentMessageId });
        dispatch({ type: "received", chatMessage });
        if(parent) dispatch({ type: "updated", chatMessage: parent }); // the reply count of the message it answers
    }, [workspaceId]);

    // Clicking an emoji you already used takes it back, otherwise it adds it
    const toggleReaction = useCallback(async (message, emoji)=>{
        const mine = message.reactions.some((reaction)=> reaction.emoji === emoji && reaction.userIds.includes(userId));

        try{
            const { chatMessage } = mine
                ? await removeReaction(workspaceId, message.id, emoji)
                : await addReaction(workspaceId, message.id, emoji);
            dispatch({ type: "updated", chatMessage });
        }
        catch(err){
            dispatch({ type: "problem", message: `Could not react : ${err.message}` });
        }
    }, [workspaceId, userId]);

    const dismissProblem = useCallback(()=> dispatch({ type: "problem", message: null }), []);

    return {
        ...state,
        send,
        loadOlder,
        openThread,
        closeThread,
        loadOlderReplies,
        toggleReaction,
        reload: loadLatest,
        dismissProblem
    };
}
