import {randomUUID} from "node:crypto";
import appEvents from "./appEvents.js";
import {createSubscriber, getRedis} from "../config/redis.js";

// Some events have to happen on EVERY server, not just the one that served the request.
//
// The rule, and the reason this file only carries three events :
//
//   * an event whose listeners only WRITE TO THE DATABASE or BROADCAST through the Socket.IO adapter must run ONCE.
//     Running it everywhere would save the same notification twice, or write the same activity line on each server.
//     Those events stay where they are ("message:created", "comment:created", "mention:created", "version:created" ...).
//
//   * an event whose listeners change a server's OWN MEMORY must run on every server, because each one can only
//     touch its own sockets and its own open documents. Somebody removed from a workspace has to be thrown out of the
//     chat on whichever server they happen to be connected to, and a deleted document has to be dropped everywhere.
//
// So exactly these three travel :
const shared = ["membership:changed", "workspace:deleted", "document:deleted"];

const channel = "converge:events";
const instanceId = randomUUID();

// While a message from another server is being handed to the local listeners, this is on. It stops the publisher
// below from sending it straight back out and the two servers bouncing it between them for ever.
// (Safe because emit() runs its listeners synchronously, so the flag is only ever on during that one call.)
let replaying = false;

// Sends the three events above to the other servers, and plays the ones they send to us into the local event bus,
// so the handlers that were written for one server keep working unchanged.
// Returns a function that stops it again (used by tests, so nothing is attached twice).
export const attachDistributedEvents = async ()=>{
    const redis = getRedis();

    if(!redis){
        return async ()=> {};       // one server : the local event bus already reaches everything there is
    }

    const publish = (name)=> (payload)=>{
        if(replaying){
            return;
        }
        redis.publish(channel, JSON.stringify({from : instanceId, name, payload}))
        .catch((err)=> console.log("Could not tell the other servers about", name, err.message));
    };

    const publishers = shared.map((name)=>{
        const handler = publish(name);
        appEvents.on(name, handler);
        return ()=> appEvents.off(name, handler);
    });

    const subscriber = await createSubscriber();

    await subscriber.subscribe(channel, (raw)=>{
        try{
            const {from, name, payload} = JSON.parse(raw);

            // our own message coming back : the local listeners already had it
            if(from === instanceId || !shared.includes(name)){
                return;
            }

            replaying = true;
            try{
                appEvents.emit(name, payload);
            }
            finally{
                replaying = false;
            }
        }
        catch(err){
            console.log("A message from another server could not be read", err.message);
        }
    });

    console.log("Listening for the events of the other servers");

    return async ()=>{
        publishers.forEach((stop)=> stop());
        await subscriber.unsubscribe(channel).catch(()=> {});
        await subscriber.quit().catch(()=> {});
    };
}

// the events that travel, for the tests and for anybody reading this later
export const distributedEventNames = shared;
