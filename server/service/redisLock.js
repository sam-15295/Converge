import {randomUUID} from "node:crypto";
import {getRedis} from "../config/redis.js";

// A short lock that only one server can hold at a time.
//
// Used where two servers doing the same thing at the same moment would go wrong : saving one document (one could
// write its copy over the other's newer one) and writing a version of it (both would write one).
//
// It is deliberately simple :
//   * SET key <me> NX PX ttl   - taken only if nobody holds it, and it expires by itself, so a server that dies
//                                while holding it cannot block the others for ever.
//   * released with a small script that only deletes the key if it is still OURS. Without that check, a lock that
//     had already expired and been taken by somebody else would be deleted from under them.
//
// Without Redis there is only one server, so there is nothing to coordinate : the work simply runs.

const me = randomUUID();

const releaseScript = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
end
return 0`;

// Runs `work` while holding the lock. Returns what `work` returned, or `notTaken` when somebody else holds it.
export const withLock = async (key, ttlMs, work, notTaken = null)=>{
    const redis = getRedis();

    if(!redis){
        return work();
    }

    const token = `${me}:${Date.now()}`;
    const taken = await redis.set(key, token, {condition : "NX", PX : ttlMs});

    if(taken !== "OK"){
        return notTaken;
    }

    try{
        return await work();
    }
    finally{
        await redis.eval(releaseScript, {keys : [key], arguments : [token]}).catch((err)=> console.log("Could not release the lock", key, err.message));
    }
}

// Does something at most once in `everyMs`, across all the servers : the first to claim it wins and the others skip.
// (Used so only ONE server writes the version of an editing session.)
export const claimOncePer = async (key, everyMs)=>{
    const redis = getRedis();

    if(!redis){
        return true;
    }

    return (await redis.set(key, me, {condition : "NX", PX : everyMs})) === "OK";
}
