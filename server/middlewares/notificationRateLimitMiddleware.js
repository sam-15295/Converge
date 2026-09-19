import env from "../config/env.js";
import createUserLimiter from "./createUserLimiter.js";

// One person may make only so many notification requests (listing, counting, marking as read) per minute.
// The app asks a few times when a page opens and once per click, so the default is generous for a real person.
const notificationRateLimitMiddleware = createUserLimiter({
    windowMs : 60 * 1000,
    limit : env.NOTIFICATION_RATE_LIMIT_MAX,
    message : "Too many requests. Please slow down."
});

export default notificationRateLimitMiddleware;
