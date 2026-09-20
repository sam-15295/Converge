import {randomUUID} from "node:crypto";
import env from "../config/env.js";
import {getRedis} from "../config/redis.js";

// Who is online in which workspace. A person counts as ONLINE in a workspace while at least one of their sockets has
// that workspace's chat open. Two tabs of the same person are ONE person : online with the first, offline with the last.
//
// There are TWO views here, and telling them apart is the whole point of this file :
//
//   * the LOCAL view (a Map in this process) : the sockets THIS server holds. Only these can be acted on - you cannot
//     call socket.emit() on a socket that lives in another process - so closing somebody's chat uses this one.
//   * the SHARED view (a sorted set in Redis) : everybody online anywhere. "Who is online" must use this one, or a
//     colleague connected to another server would look offline.
//
// Without Redis the shared view IS the local view, and everything behaves exactly as it did before.
//
// How the shared view survives a server crashing : each entry keeps the time it was last confirmed (the score of the
// sorted set), every server refreshes its own entries on a timer, and anything older than three heartbeats is ignored
// and swept away. A server that dies simply stops refreshing, and its people fade out instead of being online for ever.

const heartbeatMs = ()=> env.PRESENCE_HEARTBEAT_SECONDS * 1000;
const staleMs = ()=> heartbeatMs() * 3;

// this server, for as long as the process lives : it labels the entries this server is responsible for
const instanceId = randomUUID();

const local = new Map();        // workspaceId -> Map( userId -> Set of socket ids ), the sockets of THIS server
let heartbeat = null;

const presenceKey = (workspaceId)=> `presence:${workspaceId}`;
const entry = (userId, socketId)=> `${userId}:${socketId}:${instanceId}`;
const userOf = (member)=> member.split(":")[0];

// ---------- the local view ----------

const addLocal = (workspaceKey, userKey, socketId)=>{
    if(!local.has(workspaceKey)){
        local.set(workspaceKey, new Map());
    }

    const users = local.get(workspaceKey);

    if(!users.has(userKey)){
        users.set(userKey, new Set());
    }
    users.get(userKey).add(socketId);
}

const removeLocal = (workspaceKey, userKey, socketId)=>{
    const users = local.get(workspaceKey);
    const sockets = users?.get(userKey);

    if(!sockets || !sockets.delete(socketId)){
        return false;
    }
    if(sockets.size === 0){
        users.delete(userKey);
    }
    if(users.size === 0){
        local.delete(workspaceKey);
    }
    return true;
}

const localUserIds = (workspaceKey)=> [...(local.get(workspaceKey)?.keys() ?? [])];

const localHasUser = (workspaceKey, userKey)=> Boolean(local.get(workspaceKey)?.has(userKey));

// The socket ids THIS server holds : for one person, or for everybody in the workspace. Used to act on sockets, which
// is only ever possible for the ones in this process.
export const localSocketIdsIn = (workspaceId, userId)=>{
    const users = local.get(String(workspaceId));

    if(!users){
        return [];
    }
    if(userId !== undefined){
        return [...(users.get(String(userId)) ?? [])];
    }
    return [...users.values()].flatMap((sockets)=> [...sockets]);
}

// ---------- the shared view ----------

// everybody online in the workspace, from Redis, ignoring entries nobody has confirmed lately
const sharedUserIds = async (redis, workspaceKey)=>{
    const key = presenceKey(workspaceKey);
    const fresh = await redis.zRangeByScore(key, Date.now() - staleMs(), "+inf");

    // tidy up whatever the dead servers left behind (cheap, and keeps the set from growing for ever)
    await redis.zRemRangeByScore(key, "-inf", Date.now() - staleMs());

    return [...new Set(fresh.map(userOf))];
}

// ---------- what the chat handler calls ----------

// Returns true when this made the person newly online ANYWHERE (their first socket in this workspace).
export const addPresence = async (workspaceId, userId, socketId)=>{
    const workspaceKey = String(workspaceId);
    const userKey = String(userId);
    const redis = getRedis();

    if(!redis){
        const wasOnline = localHasUser(workspaceKey, userKey);
        addLocal(workspaceKey, userKey, socketId);
        return !wasOnline;
    }

    const wasOnline = (await sharedUserIds(redis, workspaceKey)).includes(userKey);

    addLocal(workspaceKey, userKey, socketId);
    await redis.zAdd(presenceKey(workspaceKey), {score : Date.now(), value : entry(userKey, socketId)});
    return !wasOnline;
}

// Returns true when this made the person offline EVERYWHERE (their last socket in this workspace is gone).
export const removePresence = async (workspaceId, userId, socketId)=>{
    const workspaceKey = String(workspaceId);
    const userKey = String(userId);
    const redis = getRedis();

    if(!removeLocal(workspaceKey, userKey, socketId)){
        return false;       // this server never had that socket
    }
    if(!redis){
        return !localHasUser(workspaceKey, userKey);
    }

    await redis.zRem(presenceKey(workspaceKey), entry(userKey, socketId));

    // they are offline only when no OTHER tab of theirs is left, on any server
    return !(await sharedUserIds(redis, workspaceKey)).includes(userKey);
}

// Everybody online in this workspace, on every server.
export const onlineUserIds = async (workspaceId)=>{
    const workspaceKey = String(workspaceId);
    const redis = getRedis();

    if(!redis){
        return localUserIds(workspaceKey);
    }
    return sharedUserIds(redis, workspaceKey);
}

// ---------- keeping the shared view alive ----------

// Says "these people are still here" for everything this server holds. Without it the entries would go stale and
// this server's people would fade out of the shared view while they are still connected.
export const refreshPresence = async ()=>{
    const redis = getRedis();

    if(!redis || local.size === 0){
        return;
    }

    const now = Date.now();

    for(const [workspaceKey, users] of local){
        const members = [...users].flatMap(([userKey, sockets])=>
            [...sockets].map((socketId)=> ({score : now, value : entry(userKey, socketId)})));

        if(members.length > 0){
            await redis.zAdd(presenceKey(workspaceKey), members);
        }
    }
}

export const startPresenceHeartbeat = ()=>{
    if(heartbeat || !getRedis()){
        return;
    }

    heartbeat = setInterval(()=>{
        refreshPresence().catch((err)=> console.log("Presence heartbeat failed", err.message));
    }, heartbeatMs());
    heartbeat.unref();
}

// Called when this server stops : take ITS entries out at once, instead of leaving its people to fade out slowly.
export const clearPresenceOfThisServer = async ()=>{
    const redis = getRedis();

    if(!redis){
        return;
    }

    for(const [workspaceKey, users] of local){
        const members = [...users].flatMap(([userKey, sockets])=> [...sockets].map((socketId)=> entry(userKey, socketId)));

        if(members.length > 0){
            await redis.zRem(presenceKey(workspaceKey), members).catch(()=> {});
        }
    }
}

export const resetPresence = ()=>{
    clearInterval(heartbeat);
    heartbeat = null;
    local.clear();
}
