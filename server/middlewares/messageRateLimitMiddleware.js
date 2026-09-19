import env from "../config/env.js";
import createUserLimiter from "./createUserLimiter.js";

// Flood protection for the chat : one person may do only so many things in 10 seconds.
// Messages and reactions have separate counters, so reacting a lot never stops someone from sending a message.
const createChatLimiter = (limit, message)=> createUserLimiter({windowMs : 10 * 1000, limit, message});

// sending messages and replies
const messageRateLimitMiddleware = createChatLimiter(env.CHAT_RATE_LIMIT_MAX, "You are sending messages too fast. Please slow down.");

// adding and removing reactions (a click is cheaper than a message, so the budget is twice as big)
export const reactionRateLimitMiddleware = createChatLimiter(env.CHAT_RATE_LIMIT_MAX * 2, "You are reacting too fast. Please slow down.");

export default messageRateLimitMiddleware;
