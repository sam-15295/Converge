import rateLimit from "express-rate-limit";
import env from "../config/env.js";

// Brute-force protection for login and signup, counted per client IP.
// The counter lives in this process's memory, so with several server instances each one
// counts on its own (sharing it through Redis is a later phase).
const authRateLimitMiddleware = rateLimit({
    windowMs : 15 * 60 * 1000,
    limit : env.AUTH_RATE_LIMIT_MAX,
    skipSuccessfulRequests : true,      // only FAILED attempts count, so normal users are never blocked
    standardHeaders : "draft-8",
    legacyHeaders : false,
    message : {
        message : "Too many attempts. Please try again in a few minutes."
    }
});

export default authRateLimitMiddleware;
