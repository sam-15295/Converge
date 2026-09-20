import {RedisStore} from "rate-limit-redis";
import env from "./env.js";
import {getRedis} from "./redis.js";

// Where the rate-limit counters are kept.
//
// In this process's memory, every server would allow the full budget on its own : with three servers somebody could
// send three times as many messages, or try three times as many passwords. Keeping the counters in Redis makes the
// limit mean the same thing however many servers there are.
//
// Why it looks at env.REDIS_URL and not at the connection : the limiters are built when their module is first
// imported, which happens before the server has connected to anything. The connection itself is looked up later,
// when a request actually arrives, by which time it is there.
export const sharedStore = (prefix)=>{
    if(!env.REDIS_URL){
        return undefined;       // express-rate-limit then uses its own in-memory counter, as before
    }

    return new RedisStore({
        prefix,
        sendCommand : (...args)=> getRedis().sendCommand(args)
    });
}
