// The state of one open chat, and the pure functions that change it.
// Everything that can happen (history arrives, a live message arrives, someone reacts, someone goes online) is an
// "action" handled in ONE place, so the message list can never be updated in two slightly different ways.
//
//   messages       the main chat, oldest first, no duplicates
//   hasMoreOlder   is there older history to load?
//   hasMoreNewer   is there newer history NOT loaded? (only after opening a message in the past)
//   detached       the list shows a stretch of the PAST (opened from a link) and newer messages are not loaded. Live messages are
//                  then NOT added : they would appear after a gap. "Jump to latest" (or loading forward) ends it.
//   missed         how many live messages arrived while detached
//   focus          { id, token } : the message to scroll to and highlight (id null : just go to the newest).
//                  The token changes every time, so the same message can be shown twice.
//   loaded         has the first page arrived?
//   thread         the ONE open thread : { parentId, messages, hasMoreOlder, hasMoreNewer, loaded, focus }, or null
//   onlineUserIds  who has this chat open right now
//   canSend        may this user write (a VIEWER may only read)
//   status         "connecting" | "connected" | "offline" | "denied"
//   notice         why the chat was closed (for "denied")
//   problem        the last thing that went wrong (a failed load, a refused reaction), shown to the user

export const initialChatState = {
    messages: [],
    hasMoreOlder: false,
    hasMoreNewer: false,
    detached: false,
    missed: 0,
    focus: null,
    loaded: false,
    thread: null,
    onlineUserIds: [],
    canSend: false,
    status: "connecting",
    notice: null,
    problem: null
};

const compare = (a, b)=>{
    // ISO dates sort correctly as text; the id is the tie breaker, like on the server
    if(a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Puts messages in the list. A message that is already there is REPLACED (it may have new reactions or a new
// reply count), so the same message arriving twice (from the history AND from the live event) is shown once.
export const mergeMessages = (existing, incoming)=>{
    const byId = new Map(existing.map((message)=> [message.id, message]));
    for(const message of incoming) byId.set(message.id, message);
    return [...byId.values()].sort(compare);
}

// Replaces a message that is already in the list. A message that is not there is NOT added (for example an old
// message that is not loaded).
const replaceIfPresent = (list, message)=>{
    return list.some((item)=> item.id === message.id) ? mergeMessages(list, [message]) : list;
}

// Changes the messages of the open thread, but only if it is the thread the change is about
const inThread = (state, parentId, change)=>{
    if(state.thread?.parentId !== parentId) return state;
    return { ...state, thread: { ...state.thread, messages: change(state.thread.messages) } };
}

// A page of history says HOW it fits in what we already have (action.mode) :
//   "latest"   the first page : the messages are the newest ones, and it tells whether there is more before them
//   "older"    the page before the oldest message we have (scrolling up)
//   "newer"    the newest messages again after being offline, they connect to what we have (it only refreshes and adds)
//   "replace"  the newest messages again, but they do NOT connect to what we have : start again from them
//   "forward"  the page AFTER the newest message we have (reading on, out of the past). When nothing newer is left we are
//              back in the present.
// "latest" and "replace" always end up in the present, so they end a detached view.
const presentAgain = { detached: false, hasMoreNewer: false, missed: 0 };

export const chatReducer = (state, action)=>{
    switch(action.type){
        case "history": {
            const messages = mergeMessages(action.mode === "replace" ? [] : state.messages, action.messages);
            const keepsOlder = action.mode === "newer" || action.mode === "forward";
            const hasMoreOlder = keepsOlder ? state.hasMoreOlder : action.hasMore;

            let where = {};
            if(action.mode === "latest" || action.mode === "replace") where = presentAgain;
            if(action.mode === "forward") where = { detached: action.hasMore, hasMoreNewer: action.hasMore, missed: action.hasMore ? state.missed : 0 };

            // a jump to the newest ("replace") also moves the view to the bottom
            const focus = action.mode === "replace" ? { id: null, token: action.token } : state.focus;

            return { ...state, ...where, messages, hasMoreOlder, focus, loaded: true, problem: null };
        }

        // a stretch of the past around one message (opened from a link) : replaces the list
        case "window":
            return {
                ...state,
                messages: mergeMessages([], action.messages),
                hasMoreOlder: action.hasMoreOlder,
                hasMoreNewer: action.hasMoreNewer,
                detached: action.hasMoreNewer,
                missed: 0,
                focus: { id: action.focusId, token: action.token },
                loaded: true,
                problem: null
            };

        case "received": {
            const { chatMessage } = action;
            if(!chatMessage.parentMessageId){
                // while looking at the past it would appear after a gap, so it is only counted
                if(state.detached) return { ...state, missed: state.missed + 1 };
                return { ...state, messages: mergeMessages(state.messages, [chatMessage]) };
            }
            // a reply : it only matters if that thread is open right now (and not looking at its past)
            if(state.thread?.parentId === chatMessage.parentMessageId && state.thread.hasMoreNewer) return state;
            return inThread(state, chatMessage.parentMessageId, (list)=> mergeMessages(list, [chatMessage]));
        }

        case "updated": {
            const { chatMessage } = action;
            if(!chatMessage.parentMessageId){
                return { ...state, messages: replaceIfPresent(state.messages, chatMessage) };
            }
            return inThread(state, chatMessage.parentMessageId, (list)=> replaceIfPresent(list, chatMessage));
        }

        case "openThread":
            return {
                ...state,
                thread: { parentId: action.parentId, messages: [], hasMoreOlder: false, hasMoreNewer: false, loaded: false, focus: null }
            };

        case "closeThread":
            return { ...state, thread: null };

        case "threadHistory": {
            // the answer of a thread that is not the open one any more (the user clicked another) is ignored
            if(state.thread?.parentId !== action.parentId) return state;
            const { thread } = state;
            const messages = mergeMessages(action.mode === "replace" ? [] : thread.messages, action.messages);
            const keepsOlder = action.mode === "newer" || action.mode === "forward";
            const hasMoreOlder = keepsOlder ? thread.hasMoreOlder : action.hasMore;

            let hasMoreNewer = thread.hasMoreNewer;
            if(action.mode === "latest" || action.mode === "replace") hasMoreNewer = false;
            if(action.mode === "forward") hasMoreNewer = action.hasMore;

            return { ...state, thread: { ...thread, messages, hasMoreOlder, hasMoreNewer, loaded: true }, problem: null };
        }

        // the replies of a thread around one reply (opened from a link)
        case "threadWindow": {
            if(state.thread?.parentId !== action.parentId) return state;
            return {
                ...state,
                thread: {
                    ...state.thread,
                    messages: mergeMessages([], action.messages),
                    hasMoreOlder: action.hasMoreOlder,
                    hasMoreNewer: action.hasMoreNewer,
                    loaded: true,
                    focus: { id: action.focusId, token: action.token }
                },
                problem: null
            };
        }

        case "presenceList":
            return { ...state, onlineUserIds: action.userIds };

        case "presence": {
            const others = state.onlineUserIds.filter((id)=> id !== action.userId);
            return { ...state, onlineUserIds: action.online ? [...others, action.userId] : others };
        }

        case "access":
            return { ...state, canSend: action.canSend };

        case "problem":
            return { ...state, problem: action.message };

        case "status":
            return { ...state, status: action.status, notice: action.notice ?? null };

        default:
            return state;
    }
}
