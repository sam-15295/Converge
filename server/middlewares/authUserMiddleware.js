import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import env from "../config/env.js";
import {authCookieName} from "../config/authCookie.js";
import User from "../model/userSchema.js";

// Authentication gate ("who are you?"). Put it before any route that needs a logged in user.
// On success req.user holds the user from the database.
const authUserMiddleware = async (req, res, next)=>{
    try{
        const token = req.cookies?.[authCookieName];

        if(!token){
            return res.status(401).json({
                message : "Login first"
            });
        }

        let payload;

        try{
            // the algorithm is fixed, so a token that claims "no signature needed" is rejected
            payload = jwt.verify(token, env.JWT_SECRET, {algorithms : ["HS256"]});
        }
        catch(err){
            // forged, changed or expired, we do not say which
            return res.status(401).json({
                message : "Session expired, login again"
            });
        }

        // a valid token is not enough, the account may have been deleted after it was issued
        const existingUser = mongoose.isValidObjectId(payload.sub) ? await User.findById(payload.sub) : null;

        if(!existingUser){
            return res.status(401).json({
                message : "Session expired, login again"
            });
        }

        req.user = existingUser;
        next();
    }
    catch(err){
        console.log(err);
        res.status(500).json({message : "Internal Server Error"});
    }
}

export default authUserMiddleware;
