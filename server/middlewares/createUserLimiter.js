import rateLimit from "express-rate-limit";
import {sharedStore} from "../config/rateLimitStore.js";

// Flood protection for one PERSON, not one IP address (an office shares one). Runs after authUserMiddleware, so req.user exists.
// Every limiter made here has its own counter, so different kinds of actions never use up each other's budget.
// With Redis the counter is shared, so the limit means the same thing however many servers are running.
const createUserLimiter = ({windowMs, limit, message, prefix})=>{
    // Every limiter needs its OWN key prefix. Without one they would all count into the same place in Redis and
    // commenting would use up the budget for chatting, which is the opposite of the promise above.
    if(!prefix){
        throw new Error("createUserLimiter needs a prefix, so each limiter counts on its own");
    }

    return rateLimit({
        windowMs,
        limit,
        store : sharedStore(prefix),

        // If Redis cannot be reached the request is let through instead of failing : losing the limit for a moment
        // is better than the whole app answering 500.
        passOnStoreError : true,
        keyGenerator : (req)=> String(req.user._id),
        standardHeaders : "draft-8",
        legacyHeaders : false,
        message : {message}
    });
}

export default createUserLimiter;
