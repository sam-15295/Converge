import env from "../config/env.js";
import createUserLimiter from "./createUserLimiter.js";

// Flood protection for writing comments : the same budget as chat messages (CHAT_RATE_LIMIT_MAX per 10 seconds per person),
// but its own counter, so commenting a lot never stops somebody from chatting and the other way round.
const commentRateLimitMiddleware = createUserLimiter({
    windowMs : 10 * 1000,
    limit : env.CHAT_RATE_LIMIT_MAX,
    message : "You are commenting too fast. Please slow down."
});

export default commentRateLimitMiddleware;
