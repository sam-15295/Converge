import {Server} from "socket.io";
import env from "../config/env.js";
import socketAuthMiddleware from "./socketAuthMiddleware.js";
import attachDocumentHandlers from "./documentSocketHandlers.js";
import attachChatHandlers from "./chatSocketHandlers.js";
import {flushAllRooms, resetRooms} from "../service/docRoomService.js";
import {resetPresence} from "../service/presenceService.js";

const allowedOrigin = new URL(env.CLIENT_URL).origin;

// Creates the Socket.IO server on top of the same HTTP server as the REST API (same port).
//
// Socket.IO is a library on top of WebSockets : a permanent two-way connection between browser and server, so the server
// can PUSH changes to everybody who has a document open. On top of raw WebSockets it adds rooms (one per document),
// automatic reconnection, and binary messages (Yjs updates are binary).
const createSocketServer = (httpServer)=>{
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

    io.use(socketAuthMiddleware);
    io.detachDocumentHandlers = attachDocumentHandlers(io);
    io.detachChatHandlers = attachChatHandlers(io);

    return io;
}

// Stops taking connections, saves every open document, and closes everything
export const closeSocketServer = async (io)=>{
    io.detachDocumentHandlers?.();
    io.detachChatHandlers?.();
    await flushAllRooms();
    io.disconnectSockets(true);     // do not wait for a client that is stuck
    await new Promise((resolve)=> io.close(resolve));
    await resetRooms();
    resetPresence();
}

export default createSocketServer;
