import {createClient} from "redis";
import env from "./env.js";

// Redis, and why this project has it (CLAUDE.md phase 11).
//
// Until now the server kept things in its OWN memory : who is online, every open document, the rate-limit counters.
// That only works while there is exactly one server. As soon as the app runs as several servers at once (which is how
// it would really be deployed), a message arriving at server A never reaches somebody connected to server B.
//
// Redis gives us two things :
//   * a POSTBOX  (publish / subscribe) : A publishes "this happened", every other server hears it and tells its own
//     browsers. This is what the Socket.IO Redis adapter and our document relay use.
//   * SHARED MEMORY : who is online, the rate-limit counters, and short locks, in one place all servers can read.
//
// It stays OPTIONAL. With no REDIS_URL the whole app behaves exactly as before (one server, everything in memory),
// so local development needs nothing extra and the existing tests keep their meaning.

let client = null;          // for ordinary commands (get, set, locks); null when Redis is switched off
let everConnected = false;  // has this client ever been up? (it decides how long a reconnection is worth trying)

export const isRedisEnabled = ()=> Boolean(client);

// The connection used for ordinary commands. null when Redis is switched off, so callers must check.
export const getRedis = ()=> client;

// A connection that does nothing but listen. Redis does not allow ordinary commands on a connection that is
// subscribed, so every subscriber needs its own (the Socket.IO adapter and our document relay each get one).
export const createSubscriber = async ()=>{
    if(!client){
        return null;
    }

    const subscriber = client.duplicate();

    subscriber.on("error", (err)=> console.log("Redis subscriber error", err.message));
    await subscriber.connect();
    return subscriber;
}

// Connects, or does nothing when no URL is configured. Returns the client, or null when Redis is switched off.
// The URL is a parameter (not read from env inside) so tests can point it at their own database.
export const connectRedis = async (url = env.REDIS_URL)=>{
    if(!url){
        console.log("REDIS_URL is not set : running as a single server, everything in memory");
        return null;
    }

    everConnected = false;
    client = createClient({
        url,
        socket : {
            connectTimeout : 5000,

            // A URL that is set but wrong should fail at STARTUP, loudly, instead of the server coming up and
            // quietly not talking to the other servers. But once Redis has worked, a later hiccup is worth
            // retrying for a long time, because everything else keeps running meanwhile.
            reconnectStrategy : (retries)=>{
                if(!everConnected && retries > 5){
                    return new Error("Redis is not reachable");
                }
                return Math.min(retries * 200, 3000);
            }
        }
    });

    // Redis going away must never crash the server : it reconnects by itself, and everything this instance does on
    // its own keeps working meanwhile.
    client.on("error", (err)=> console.log("Redis error", err.message));
    client.on("ready", ()=>{
        everConnected = true;
    });

    await client.connect();
    console.log(`Connected to Redis at ${new URL(url).host}`);
    return client;
}

export const closeRedis = async ()=>{
    if(!client){
        return;
    }

    const closing = client;
    client = null;

    // quit() waits politely for the replies that are still on their way, which hangs when the connection is already
    // broken. So it gets a moment, and then the socket is closed by force.
    await Promise.race([
        closing.quit().catch(()=> {}),
        new Promise((resolve)=> setTimeout(resolve, 1000))
    ]);

    try{
        closing.destroy();
    }
    catch{
        // already closed by quit()
    }
}

// how the health endpoint describes Redis
export const redisStatus = ()=>{
    if(!client){
        return "disabled";
    }
    return client.isReady ? "connected" : "connecting";
}
