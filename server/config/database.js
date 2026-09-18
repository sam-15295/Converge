import mongoose from "mongoose";
import env from "./env.js";

const connectDB = async()=>{
    mongoose.connection.on("disconnected", ()=>{
        console.log("Database disconnected");
    });

    mongoose.connection.on("reconnected", ()=>{
        console.log("Database reconnected");
    });

    // give up after 5 seconds if MongoDB is not reachable (default is 30 seconds)
    await mongoose.connect(env.MONGODB_URI, {serverSelectionTimeoutMS : 5000});
    console.log("Connected to Database Successfully");
}

export default connectDB;
