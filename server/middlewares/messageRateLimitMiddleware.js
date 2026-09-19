import rateLimit from "express-rate-limit";
import env from "../config/env.js";

// Flood protection for the chat : one PERSON (not one IP address, an office shares one) may do only so many
// things in 10 seconds. Runs after authUserMiddleware, so req.user exists.
// Messages and reactions have separate counters, so reacting a lot never stops someone from sending a message.
// The counters are in this process's memory. With several server instances each counts alone (Redis later).
const createChatLimiter = (limit, message)=>{
    return rateLimit({
        windowMs : 10 * 1000,
        limit,
        keyGenerator : (req)=> String(req.user._id),
        standardHeaders : "draft-8",
        legacyHeaders : false,
        message : {message}
    });
}

// sending messages and replies
const messageRateLimitMiddleware = createChatLimiter(env.CHAT_RATE_LIMIT_MAX, "You are sending messages too fast. Please slow down.");

// adding and removing reactions (a click is cheaper than a message, so the budget is twice as big)
export const reactionRateLimitMiddleware = createChatLimiter(env.CHAT_RATE_LIMIT_MAX * 2, "You are reacting too fast. Please slow down.");

export default messageRateLimitMiddleware;
