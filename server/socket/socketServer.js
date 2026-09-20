import {Server} from "socket.io";
import {createAdapter} from "@socket.io/redis-adapter";
import env from "../config/env.js";
import {createSubscriber, getRedis} from "../config/redis.js";
import socketAuthMiddleware from "./socketAuthMiddleware.js";
import attachDocumentHandlers from "./documentSocketHandlers.js";
import attachChatHandlers from "./chatSocketHandlers.js";
import attachNotificationHandlers from "./notificationSocketHandlers.js";
import attachCommentHandlers from "./commentSocketHandlers.js";
import {flushAllRooms, resetRooms} from "../service/docRoomService.js";
import {flushAllVersions} from "../service/versionScheduler.js";
import {clearPresenceOfThisServer, resetPresence, startPresenceHeartbeat} from "../service/presenceService.js";

const allowedOrigin = new URL(env.CLIENT_URL).origin;

// Makes this server's rooms reach the OTHER servers.
//
// `io.to(room).emit(...)` normally only reaches the browsers connected to THIS process. With several servers behind
// one address, a chat message sent to server A would never reach somebody connected to server B. The Redis adapter
// fixes that : every broadcast is also published to Redis, and each server delivers it to its own browsers.
//
//     server A : io.to("chat:42").emit(...)  ->  Redis  ->  server B : delivers to its browsers in chat:42
//
// Nothing else in the code changes : the handlers still say io.to(room).emit and do not know how far it travels.
// Without Redis this does nothing and the server keeps working on its own.
const attachRedisAdapter = async (io)=>{
    const publisher = getRedis();

    if(!publisher){
        return;
    }

    // The adapter needs one connection to publish and one to listen : a connection that is subscribed cannot run
    // ordinary commands (see config/redis.js).
    const subscriber = await createSubscriber();

    io.adapter(createAdapter(publisher, subscriber));
    io.redisSubscriber = subscriber;    // kept so it can be closed with the server
    console.log("Socket.IO is using the Redis adapter : broadcasts reach every server");
}

// Creates the Socket.IO server on top of the same HTTP server as the REST API (same port).
//
// Socket.IO is a library on top of WebSockets : a permanent two-way connection between browser and server, so the server
// can PUSH changes to everybody who has a document open. On top of raw WebSockets it adds rooms (one per document),
// automatic reconnection, and binary messages (Yjs updates are binary).
const createSocketServer = async (httpServer)=>{
    const io = new Server(httpServer, {
        serveClient : false,
        maxHttpBufferSize : 1e6,        // one message may be at most 1 MB

        // CROSS-SITE WEBSOCKET HIJACKING : browsers attach cookies to a WebSocket handshake started by ANY website,
        // so another site could open a socket as the logged in user. The Origin header names the site that started
        // the handshake and a web page cannot fake it : anything except our own frontend is refused.
        // A client with no Origin (curl, a script) is no browser risk : it would have to bring the cookie itself.
        allowRequest : (req, callback)=>{
            const origin = req.headers.origin;
            callback(null, origin === undefined || origin === allowedOrigin);
        },

        cors : {origin : env.CLIENT_URL, credentials : true}
    });

    // before the handlers, so no broadcast can happen while the adapter is still being set up
    await attachRedisAdapter(io);

    // tells the other servers, again and again, that the people connected here are still here
    startPresenceHeartbeat();

    io.use(socketAuthMiddleware);
    io.detachDocumentHandlers = attachDocumentHandlers(io);
    io.detachChatHandlers = attachChatHandlers(io);
    io.detachNotificationHandlers = attachNotificationHandlers(io);
    io.detachCommentHandlers = attachCommentHandlers(io);

    return io;
}

// Stops taking connections, saves every open document, and closes everything
export const closeSocketServer = async (io)=>{
    io.detachDocumentHandlers?.();
    io.detachChatHandlers?.();
    io.detachNotificationHandlers?.();
    io.detachCommentHandlers?.();
    await flushAllRooms();
    await flushAllVersions();   // a session that was waiting for its version still gets one
    io.disconnectSockets(true);     // do not wait for a client that is stuck
    await new Promise((resolve)=> io.close(resolve));
    await io.redisSubscriber?.quit().catch(()=> {});

    // take this server's people out of the shared view now, instead of leaving them to fade out
    await clearPresenceOfThisServer();
    await resetRooms();
    resetPresence();
}

export default createSocketServer;
