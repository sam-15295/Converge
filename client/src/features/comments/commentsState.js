// The state of the comments panel of ONE document, and the pure functions that change it.
// Like the chat, everything that can happen (a page arrives, somebody writes, resolves, deletes) is an "action" handled in
// ONE place, so the list can never be updated in two slightly different ways.
//
//   threads       the threads of the chosen status, newest first, each with its replies (oldest first)
//   hasMore       is there an older page of threads to load?
//   loaded        has the first page arrived?
//   status        "open" | "resolved" : which threads the list shows
//   openCount     how many threads are open (the number on the button), worked out by the SERVER
//   canComment    may this user write (a VIEWER may only read)
//   connection    "connecting" | "connected" | "offline" | "denied"
//   notice        why the comments were closed (for "denied")
//   problem       the last thing that went wrong, shown to the user (the next page of threads that loads clears it)
//   linked        { thread, replyId, token } : the thread a link (a notification) pointed at, shown at the top and highlighted.
//                 It is kept up to date like the others. The token is new for every visit, so the same link works twice.
//   linkNotice    why the link could not be opened (the comment is gone). Kept apart from `problem` : it belongs to the link,
//                 so loading the list must not wipe it. It stays until the user dismisses it or follows another link.

export const commentMaxLength = 2000; // the same limit as the server

export const initialCommentsState = {
    threads: [],
    hasMore: false,
    loaded: false,
    status: "open",
    openCount: 0,
    canComment: false,
    connection: "connecting",
    notice: null,
    problem: null,
    linked: null,
    linkNotice: null
};

const newestFirst = (a, b)=>{
    // ISO dates sort correctly as text; the id is the tie breaker, like on the server
    if(a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

const oldestFirst = (a, b)=> newestFirst(b, a);

// Puts threads in the list. One that is already there is REPLACED, so the same thread arriving twice (from the answer of
// the request AND from the live push) is shown once.
export const mergeThreads = (existing, incoming)=>{
    const byId = new Map(existing.map((thread)=> [thread.id, thread]));
    for(const thread of incoming) byId.set(thread.id, thread);
    return [...byId.values()].sort(newestFirst);
}

const addReply = (thread, reply)=>{
    if(thread.replies.some((item)=> item.id === reply.id)) return thread;
    return { ...thread, replies: [...thread.replies, reply].sort(oldestFirst) };
}

// Changes one thread wherever it is shown (in the list and as the linked thread)
const changeThread = (state, threadId, change)=>{
    return {
        ...state,
        threads: state.threads.map((thread)=> (thread.id === threadId ? change(thread) : thread)),
        linked: state.linked?.thread.id === threadId ? { ...state.linked, thread: change(state.linked.thread) } : state.linked
    };
}

const withCount = (state, openCount)=> (openCount === undefined ? state : { ...state, openCount });

export const commentsReducer = (state, action)=>{
    switch(action.type){
        case "loaded": {
            // the answer of a list that is not the one shown any more (the user switched Open / Resolved) is ignored
            if(action.status !== state.status) return state;
            return withCount({ ...state, threads: action.threads, hasMore: action.hasMore, loaded: true, problem: null }, action.openCount);
        }

        case "more":
            return { ...state, threads: mergeThreads(state.threads, action.threads), hasMore: action.hasMore, problem: null };

        case "status":
            return { ...state, status: action.status, threads: [], hasMore: false, loaded: false };

        // somebody wrote a comment (or a reply)
        case "created": {
            const { comment } = action;
            const next = withCount(state, action.openCount);

            if(comment.parentCommentId){
                return changeThread(next, comment.parentCommentId, (thread)=> addReply(thread, comment));
            }
            // a new thread is open, so it only belongs in the list of open threads
            if(next.status !== "open") return next;
            return { ...next, threads: mergeThreads(next.threads, [{ ...comment, replies: [] }]) };
        }

        // a thread was resolved or reopened : it moves between the Open and the Resolved list
        case "threadUpdated": {
            const { thread } = action;
            const next = withCount(state, action.openCount);
            const belongsHere = next.status === "resolved" ? thread.resolved : !thread.resolved;
            const others = next.threads.filter((item)=> item.id !== thread.id);
            const last = next.threads.at(-1);

            // A thread older than the pages loaded so far is not put in the middle of them : it comes with "Load more"
            const inLoadedRange = !next.hasMore || (last && newestFirst(thread, last) <= 0);

            return {
                ...next,
                threads: belongsHere && inLoadedRange ? mergeThreads(others, [thread]) : others,
                linked: next.linked?.thread.id === thread.id ? { ...next.linked, thread } : next.linked
            };
        }

        // parentCommentId null : the whole thread is gone. Otherwise only that reply.
        case "removed": {
            const next = withCount(state, action.openCount);

            if(!action.parentCommentId){
                return {
                    ...next,
                    threads: next.threads.filter((thread)=> thread.id !== action.commentId),
                    linked: next.linked?.thread.id === action.commentId ? null : next.linked
                };
            }
            return changeThread(next, action.parentCommentId, (thread)=> ({
                ...thread,
                replies: thread.replies.filter((reply)=> reply.id !== action.commentId)
            }));
        }

        case "linked":
            return { ...state, linkNotice: null, linked: { thread: action.thread, replyId: action.replyId, token: action.token } };

        case "linkFailed":
            return { ...state, linked: null, linkNotice: action.message };

        case "clearLinked":
            return { ...state, linked: null, linkNotice: null };

        case "access":
            return { ...state, canComment: action.canComment };

        case "connection":
            return { ...state, connection: action.connection, notice: action.notice ?? null };

        case "problem":
            return { ...state, problem: action.message };

        default:
            return state;
    }
}
