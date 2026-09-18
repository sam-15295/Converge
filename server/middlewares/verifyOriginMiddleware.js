import env from "../config/env.js";

const safeMethods = ["GET", "HEAD", "OPTIONS"];
const allowedOrigin = new URL(env.CLIENT_URL).origin;   // removes any trailing slash

// CSRF protection (extra layer on top of the SameSite cookie).
// Browsers add an Origin header to cross-site requests and a web page cannot fake it.
// If a request that changes data says it comes from any site other than our frontend, reject it.
// Requests with NO Origin (curl, tests, server to server) are not a browser cookie risk, so they pass.
const verifyOriginMiddleware = (req, res, next)=>{
    if(safeMethods.includes(req.method)){
        return next();
    }

    const origin = req.get("origin");

    if(origin !== undefined && origin !== allowedOrigin){
        return res.status(403).json({
            message : "Cross-origin request blocked"
        });
    }

    next();
}

export default verifyOriginMiddleware;
