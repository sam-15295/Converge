import mongoose from "mongoose";
import app from "./app.js";
import env from "./config/env.js";
import connectDB from "./config/database.js";

const startServer = async ()=>{
    try{
        await connectDB();

        const server = app.listen(env.PORT, ()=>{
            console.log(`Server has started listening at port ${env.PORT}`);
        });

        // Graceful shutdown : stop taking new requests, let the running ones finish, close the database.
        // SIGINT is Ctrl+C, SIGTERM is what hosting platforms send when they redeploy.
        const shutdown = (signal)=>{
            console.log(`${signal} received, shutting down`);

            server.close(async ()=>{
                await mongoose.disconnect();
                process.exit(0);
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
