import mongoose from "mongoose";

// mongoose.connection.readyState is a number from 0 to 3
const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];

export const getHealth = (req, res)=>{
    const database = dbStates[mongoose.connection.readyState] ?? "unknown";
    const healthy = database === "connected";

    // 503 tells load balancers and uptime checkers that this instance should not get traffic
    res.status(healthy ? 200 : 503).json({
        message : healthy ? "Server is healthy" : "Server is running but the database is not connected",
        status : healthy ? "ok" : "degraded",
        database,
        uptimeSeconds : Math.round(process.uptime()),
        timestamp : new Date().toISOString()
    });
}
