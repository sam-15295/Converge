import rateLimit from "express-rate-limit";
import env from "../config/env.js";
import {sharedStore} from "../config/rateLimitStore.js";

// Brute-force protection for login and signup, counted per client IP.
// With Redis the counter is shared by every server, so the attempts cannot simply be spread over them.
const authRateLimitMiddleware = rateLimit({
    windowMs : 15 * 60 * 1000,
    limit : env.AUTH_RATE_LIMIT_MAX,
    store : sharedStore("rl:auth:"),
    passOnStoreError : true,
    skipSuccessfulRequests : true,      // only FAILED attempts count, so normal users are never blocked
    standardHeaders : "draft-8",
    legacyHeaders : false,
    message : {
        message : "Too many attempts. Please try again in a few minutes."
    }
});

export default authRateLimitMiddleware;
