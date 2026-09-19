// The state of ONE list of notifications (the bell's dropdown, or the inbox page), and the pure functions that change it.
// Like the chat, every change is an "action" handled in one place, so the list can never be updated in two different ways.
//
//   items     newest first, no duplicates
//   hasMore   is there an older page to load?
//   loaded    has the first page arrived?
//   problem   the last thing that went wrong, shown to the user
//
// onlyUnread : this list shows only unread notifications, so one that is read (here or in another tab) has to leave it.

export const initialListState = {
    items: [],
    hasMore: false,
    loaded: false,
    problem: null
};

const newestFirst = (a, b)=>{
    // ISO dates sort correctly as text; the id is the tie breaker, like on the server
    if(a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

// Puts notifications in the list. One that is already there is REPLACED (it may have been read meanwhile), so the same
// notification arriving twice (in a page AND as a live push) is shown once.
export const mergeNotifications = (existing, incoming)=>{
    const byId = new Map(existing.map((item)=> [item.id, item]));
    for(const item of incoming) byId.set(item.id, item);
    return [...byId.values()].sort(newestFirst);
}

export const listReducer = (state, action)=>{
    switch(action.type){
        case "loaded":
            return { ...state, items: action.items, hasMore: action.hasMore, loaded: true, problem: null };

        case "more":
            return { ...state, items: mergeNotifications(state.items, action.items), hasMore: action.hasMore, problem: null };

        // a new notification pushed by the server
        case "received":
            return { ...state, items: mergeNotifications(state.items, [action.notification]) };

        // one was read (by a click here, or in another tab)
        case "read": {
            const items = state.items.map((item)=> (item.id === action.notificationId ? { ...item, read: true } : item));
            return { ...state, items: action.onlyUnread ? items.filter((item)=> !item.read) : items };
        }

        case "allRead":
            return { ...state, items: action.onlyUnread ? [] : state.items.map((item)=> ({ ...item, read: true })) };

        case "problem":
            return { ...state, problem: action.message };

        default:
            return state;
    }
}

// Where a notification leads : the chat, at the message it is about.
// For a reply the message to open is the one it answers (its thread), and the reply itself is named too.
export const notificationLink = (notification)=>{
    const parentId = notification.preview?.parentMessageId;
    const base = `/workspace/${notification.workspace.id}/chat`;

    if(parentId) return `${base}?message=${parentId}&reply=${notification.sourceId}`;
    return `${base}?message=${notification.sourceId}`;
}
