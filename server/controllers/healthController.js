import mongoose from "mongoose";
import {redisStatus} from "../config/redis.js";

// mongoose.connection.readyState is a number from 0 to 3
const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];

export const getHealth = (req, res)=>{
    const database = dbStates[mongoose.connection.readyState] ?? "unknown";

    // Redis is only reported, never part of "healthy" : without it the server still serves everybody connected to
    // it, so taking the instance out of rotation would make things worse, not better.
    const healthy = database === "connected";

    // 503 tells load balancers and uptime checkers that this instance should not get traffic
    res.status(healthy ? 200 : 503).json({
        message : healthy ? "Server is healthy" : "Server is running but the database is not connected",
        status : healthy ? "ok" : "degraded",
        database,
        redis : redisStatus(),
        uptimeSeconds : Math.round(process.uptime()),
        timestamp : new Date().toISOString()
    });
}
