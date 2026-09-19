// The state of one open chat, and the pure functions that change it.
// Everything that can happen (history arrives, a live message arrives, someone reacts, someone goes online) is an
// "action" handled in ONE place, so the message list can never be updated in two slightly different ways.
//
//   messages       the main chat, oldest first, no duplicates
//   hasMoreOlder   is there older history to load?
//   loaded         has the first page arrived?
//   thread         the ONE open thread : { parentId, messages, hasMoreOlder, loaded }, or null
//   onlineUserIds  who has this chat open right now
//   canSend        may this user write (a VIEWER may only read)
//   status         "connecting" | "connected" | "offline" | "denied"
//   notice         why the chat was closed (for "denied")
//   problem        the last thing that went wrong (a failed load, a refused reaction), shown to the user

export const initialChatState = {
    messages: [],
    hasMoreOlder: false,
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
export const chatReducer = (state, action)=>{
    switch(action.type){
        case "history": {
            const messages = mergeMessages(action.mode === "replace" ? [] : state.messages, action.messages);
            const hasMoreOlder = action.mode === "newer" ? state.hasMoreOlder : action.hasMore;
            return { ...state, messages, hasMoreOlder, loaded: true, problem: null };
        }

        case "received": {
            const { chatMessage } = action;
            if(!chatMessage.parentMessageId){
                return { ...state, messages: mergeMessages(state.messages, [chatMessage]) };
            }
            // a reply : it only matters if that thread is open right now
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
            return { ...state, thread: { parentId: action.parentId, messages: [], hasMoreOlder: false, loaded: false } };

        case "closeThread":
            return { ...state, thread: null };

        case "threadHistory": {
            // the answer of a thread that is not the open one any more (the user clicked another) is ignored
            if(state.thread?.parentId !== action.parentId) return state;
            const messages = mergeMessages(action.mode === "replace" ? [] : state.thread.messages, action.messages);
            const hasMoreOlder = action.mode === "newer" ? state.thread.hasMoreOlder : action.hasMore;
            return { ...state, thread: { ...state.thread, messages, hasMoreOlder, loaded: true }, problem: null };
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
