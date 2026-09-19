// Who is online in which workspace. A person counts as ONLINE in a workspace while at least one of their sockets
// has that workspace's chat open. Two browser tabs of the same person are ONE person: they become online when the
// first tab opens and offline only when the last one closes.
//
// It lives in this process's memory, so with several server instances each would only know its own connections.
// Sharing it (Redis) is a later phase.

const online = new Map();       // workspaceId -> Map( userId -> Set of socket ids )

// Returns true when this made the person newly online (their first socket in this workspace)
export const addPresence = (workspaceId, userId, socketId)=>{
    const workspaceKey = String(workspaceId);
    const userKey = String(userId);

    if(!online.has(workspaceKey)){
        online.set(workspaceKey, new Map());
    }

    const users = online.get(workspaceKey);
    const wasOnline = users.has(userKey);

    if(!wasOnline){
        users.set(userKey, new Set());
    }
    users.get(userKey).add(socketId);

    return !wasOnline;
}

// Returns true when this made the person offline (their last socket in this workspace is gone)
export const removePresence = (workspaceId, userId, socketId)=>{
    const workspaceKey = String(workspaceId);
    const userKey = String(userId);
    const users = online.get(workspaceKey);
    const sockets = users?.get(userKey);

    if(!sockets || !sockets.delete(socketId) || sockets.size > 0){
        return false;
    }

    users.delete(userKey);
    if(users.size === 0){
        online.delete(workspaceKey);
    }
    return true;
}

export const onlineUserIds = (workspaceId)=> [...(online.get(String(workspaceId))?.keys() ?? [])];

// the socket ids of one person in a workspace, or of everybody there when no user is given
export const socketIdsIn = (workspaceId, userId)=>{
    const users = online.get(String(workspaceId));

    if(!users){
        return [];
    }
    if(userId !== undefined){
        return [...(users.get(String(userId)) ?? [])];
    }
    return [...users.values()].flatMap((sockets)=> [...sockets]);
}

export const resetPresence = ()=> online.clear();
