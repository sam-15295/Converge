import rateLimit from "express-rate-limit";

// Flood protection for one PERSON, not one IP address (an office shares one). Runs after authUserMiddleware, so req.user exists.
// Every limiter made here has its own counter, so different kinds of actions never use up each other's budget.
// The counters are in this process's memory. With several server instances each counts alone (Redis later).
const createUserLimiter = ({windowMs, limit, message})=>{
    return rateLimit({
        windowMs,
        limit,
        keyGenerator : (req)=> String(req.user._id),
        standardHeaders : "draft-8",
        legacyHeaders : false,
        message : {message}
    });
}

export default createUserLimiter;
