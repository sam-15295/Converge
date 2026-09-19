import { useCallback, useEffect, useReducer, useRef } from "react";
import { io } from "socket.io-client";
import { createComment, deleteComment, getThread, getThreads, reopenThread, resolveThread } from "./commentsApi";
import { commentsReducer, initialCommentsState } from "./commentsState";

const pageSize = 30;

// Everything the comments of one document need, in one place :
//   - the live connection (Socket.IO) : comments, replies, resolving and deleting arrive by themselves, with the number
//     of open threads worked out by the server
//   - the threads (REST) : the newest first, older ones on demand
//   - the actions : write, reply, resolve, reopen, delete
//
// Like in the chat, comments are WRITTEN with the REST API and READ live from the socket, so after writing, the answer of the
// request and the same comment coming back over the socket both arrive : the reducer recognises it by its id.
//
// focus : { commentId, replyId, key } when the page was opened from a link (a notification) : that thread is read on its own
// and shown at the top, highlighted. `key` is different for every visit, so following the same link twice works twice.
export const useDocumentComments = (workspaceId, documentId, canCommentByRole, focus)=>{
    const [state, dispatch] = useReducer(commentsReducer, { ...initialCommentsState, canComment: canCommentByRole });

    // The socket callbacks live for a long time, so they read the newest state from here
    const latest = useRef(state);
    useEffect(()=>{
        latest.current = state;
    });

    // ---------- reading ----------

    const loadFirstPage = useCallback(async (status)=>{
        try{
            const { threads, hasMore, openCount } = await getThreads(workspaceId, documentId, { status, limit: pageSize });
            dispatch({ type: "loaded", status, threads, hasMore, openCount });
        }
        catch(err){
            dispatch({ type: "problem", message: `Could not load the comments : ${err.message}` });
        }
    }, [workspaceId, documentId]);

    const loadMore = useCallback(async ()=>{
        const oldest = latest.current.threads.at(-1);
        if(!oldest) return;

        try{
            const { threads, hasMore } = await getThreads(workspaceId, documentId, { status: latest.current.status, before: oldest.id, limit: pageSize });
            dispatch({ type: "more", threads, hasMore });
        }
        catch(err){
            dispatch({ type: "problem", message: `Could not load more comments : ${err.message}` });
        }
    }, [workspaceId, documentId]);

    const showStatus = useCallback((status)=>{
        dispatch({ type: "status", status });
        loadFirstPage(status);
    }, [loadFirstPage]);

    // ---------- the connection ----------

    useEffect(()=>{
        let stopped = false; // this effect was cleaned up (left the page)
        let closedForGood = false; // the server said "no" : reconnecting would not help

        // same origin as the page (the dev server forwards /socket.io to the backend). The login cookie travels with it.
        const socket = io({ transports: ["websocket"], withCredentials: true });

        const closeForGood = (notice)=>{
            closedForGood = true;
            dispatch({ type: "connection", connection: "denied", notice });
            socket.disconnect();
        }

        // Runs on the first connection AND after every reconnection. Join FIRST, so live pushes start flowing, and only then
        // read the threads : a comment written in between shows up in both and is shown once.
        socket.on("connect", ()=>{
            socket.emit("comments:join", { workspaceId, documentId }, (answer)=>{
                if(!answer?.ok){
                    closeForGood("This document does not exist, or you cannot open its comments.");
                    return;
                }
                dispatch({ type: "access", canComment: answer.canComment });
                dispatch({ type: "connection", connection: "connected" });
                loadFirstPage(latest.current.status);
            });
        });

        socket.on("comment:new", ({ comment, openCount })=> dispatch({ type: "created", comment, openCount }));
        socket.on("comment:updated", ({ thread, openCount })=> dispatch({ type: "threadUpdated", thread, openCount }));
        socket.on("comment:removed", ({ commentId, parentCommentId, openCount })=> dispatch({ type: "removed", commentId, parentCommentId, openCount }));
        socket.on("comment:access", ({ canComment })=> dispatch({ type: "access", canComment }));
        socket.on("comment:error", ({ message })=> closeForGood(message));

        socket.on("disconnect", ()=>{
            if(!stopped && !closedForGood) dispatch({ type: "connection", connection: "offline" });
        });

        socket.on("connect_error", (error)=>{
            // "Unauthorized" = not logged in (any more) : trying again will not help. Anything else is a network problem.
            if(error.message === "Unauthorized") closeForGood("You are not logged in.");
            else dispatch({ type: "connection", connection: "offline" });
        });

        return ()=>{
            stopped = true;
            socket.disconnect();
        };
    }, [workspaceId, documentId, loadFirstPage]);

    // ---------- opened from a link ----------

    const handledFocus = useRef(null);

    useEffect(()=>{
        if(!focus?.commentId || handledFocus.current === focus.key) return;
        handledFocus.current = focus.key;

        (async ()=>{
            try{
                const { thread } = await getThread(workspaceId, documentId, focus.commentId);
                dispatch({ type: "linked", thread, replyId: focus.replyId, token: Date.now() });
            }
            catch(err){
                dispatch({ type: "linkFailed", message: err.status === 404 ? "That comment could not be found." : `Could not open the comment : ${err.message}` });
            }
        })();
    }, [focus, workspaceId, documentId]);

    // ---------- actions ----------

    // Writes a comment, or a reply. A failure is thrown, so the composer can show it and keep the text.
    const write = useCallback(async (content, parentCommentId, mentions)=>{
        const { comment } = await createComment(workspaceId, documentId, { content, parentCommentId, mentions });
        dispatch({ type: "created", comment });
    }, [workspaceId, documentId]);

    const changeResolved = useCallback(async (threadId, resolved)=>{
        try{
            const { thread } = resolved ? await resolveThread(workspaceId, documentId, threadId) : await reopenThread(workspaceId, documentId, threadId);
            dispatch({ type: "threadUpdated", thread });
        }
        catch(err){
            dispatch({ type: "problem", message: `Could not ${resolved ? "resolve" : "reopen"} the thread : ${err.message}` });
        }
    }, [workspaceId, documentId]);

    const resolve = useCallback((threadId)=> changeResolved(threadId, true), [changeResolved]);
    const reopen = useCallback((threadId)=> changeResolved(threadId, false), [changeResolved]);

    const remove = useCallback(async (comment)=>{
        try{
            await deleteComment(workspaceId, documentId, comment.id);
            dispatch({ type: "removed", commentId: comment.id, parentCommentId: comment.parentCommentId });
        }
        catch(err){
            dispatch({ type: "problem", message: `Could not delete the comment : ${err.message}` });
        }
    }, [workspaceId, documentId]);

    const dismissProblem = useCallback(()=> dispatch({ type: "problem", message: null }), []);
    const clearLinked = useCallback(()=> dispatch({ type: "clearLinked" }), []);

    return { ...state, loadMore, showStatus, write, resolve, reopen, remove, dismissProblem, clearLinked, reload: ()=> loadFirstPage(latest.current.status) };
}
