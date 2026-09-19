import rateLimit from "express-rate-limit";
import env from "../config/env.js";

// Flood protection for the chat : one PERSON (not one IP address, an office shares one) may send only so many
// messages in 10 seconds. Runs after authUserMiddleware, so req.user exists.
// The counter is in this process's memory. With several server instances each counts alone (Redis later).
const messageRateLimitMiddleware = rateLimit({
    windowMs : 10 * 1000,
    limit : env.CHAT_RATE_LIMIT_MAX,
    keyGenerator : (req)=> String(req.user._id),
    standardHeaders : "draft-8",
    legacyHeaders : false,
    message : {
        message : "You are sending messages too fast. Please slow down."
    }
});

export default messageRateLimitMiddleware;
