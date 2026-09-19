import http from "node:http";
import mongoose from "mongoose";
import app from "./app.js";
import env from "./config/env.js";
import connectDB from "./config/database.js";
import createSocketServer, {closeSocketServer} from "./socket/socketServer.js";

const startServer = async ()=>{
    try{
        await connectDB();

        // one HTTP server for both the REST API (Express) and the real-time connections (Socket.IO), on the same port
        const server = http.createServer(app);
        const io = createSocketServer(server);

        server.listen(env.PORT, ()=>{
            console.log(`Server has started listening at port ${env.PORT}`);
        });

        // Graceful shutdown : stop taking new requests, save every open document, let the running requests finish, close the database.
        // SIGINT is Ctrl+C, SIGTERM is what hosting platforms send when they redeploy.
        const shutdown = (signal)=>{
            console.log(`${signal} received, shutting down`);

            closeSocketServer(io).then(()=>{
                server.close(async ()=>{
                    await mongoose.disconnect();
                    process.exit(0);
                });
            });
        }

        process.on("SIGINT", ()=> shutdown("SIGINT"));
        process.on("SIGTERM", ()=> shutdown("SIGTERM"));
    }
    catch(err){
        console.log(err);
        process.exit(1);
    }
}

startServer();

//config folder --> settings and all the external connections (env, database, cookie)
//model folder --> all the models are placed here
//validators folder --> Zod schemas that check what the client sends
//controllers folder --> the logic of every route
//routes folder --> which URL goes to which controller
//middlewares folder --> functions that run before the controllers
//service folder --> logic that does not belong to one route (Yjs helpers, the live document rooms)
//socket folder --> the real-time (Socket.IO) side : login check and the document protocol
//events folder --> a small event bus, so a controller can say what happened without knowing who listens
