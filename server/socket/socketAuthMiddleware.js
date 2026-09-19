import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import {parseCookie} from "cookie";
import env from "../config/env.js";
import {authCookieName} from "../config/authCookie.js";
import User from "../model/userSchema.js";

// WebSocket authentication. A socket connection starts as a normal HTTP request (the "handshake"), and the browser
// attaches the login cookie to it, exactly like for the REST API. So the same cookie proves who the user is.
// The user is checked ONCE here, when the connection is made, and is remembered in socket.data.user.
// The token is never taken from the message payload or the URL, only from the HttpOnly cookie.
const socketAuthMiddleware = async (socket, next)=>{
    try{
        const cookies = parseCookie(socket.handshake.headers.cookie ?? "");
        const token = cookies[authCookieName];

        if(!token){
            return next(new Error("Unauthorized"));
        }

        let payload;

        try{
            payload = jwt.verify(token, env.JWT_SECRET, {algorithms : ["HS256"]});
        }
        catch(err){
            return next(new Error("Unauthorized"));
        }

        const user = mongoose.isValidObjectId(payload.sub) ? await User.findById(payload.sub) : null;

        if(!user){
            return next(new Error("Unauthorized"));
        }

        socket.data.user = {id : String(user._id), name : user.name};
        next();
    }
    catch(err){
        console.log(err);
        next(new Error("Internal Server Error"));
    }
}

export default socketAuthMiddleware;
