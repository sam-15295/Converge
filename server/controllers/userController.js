import User from "../model/userSchema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import env from "../config/env.js";
import {authCookieName, authCookieOptions} from "../config/authCookie.js";
import {signupSchema, loginSchema, updateProfileSchema} from "../validators/userValidator.js";
import formatZodErrors from "../validators/formatZodErrors.js";

const mongoDuplicateKey = 11000;

// The token only holds the user id (sub) and an expiry.
// A JWT is signed, not encrypted, anyone can read it, so never put secrets in it.
const createToken = (id)=>{
    const token = jwt.sign({}, env.JWT_SECRET, {
        subject : String(id),
        expiresIn : `${env.JWT_EXPIRES_IN_DAYS}d`,
        algorithm : "HS256"
    });
    return token;
}

// only these fields are ever sent to the client
const formatUser = (user)=>{
    return {
        id : user._id,
        name : user.name,
        email : user.email
    };
}

// Used when the email does not exist, so that path still spends the same time hashing as a real login.
// Otherwise the response time would show which emails have an account. Created once, on first use.
let dummyHash;

const getDummyHash = async ()=>{
    if(!dummyHash){
        dummyHash = await bcrypt.hash("dummy-password", env.BCRYPT_ROUNDS);
    }
    return dummyHash;
}

export const signup = async (req, res)=>{
    try{
        const result = signupSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const {name, email, password} = result.data;

        const hashPassword = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

        let userCreated;

        try{
            userCreated = await User.create({
                name,
                email,
                password : hashPassword
            });
        }
        catch(err){
            // We rely on the unique index instead of "findOne, then create" : two requests at the
            // same moment could both pass a findOne check, but only one can pass the index.
            if(err.code === mongoDuplicateKey){
                return res.status(409).json({
                    message : "Email Id already exist"
                });
            }
            throw err;
        }

        res.cookie(authCookieName, createToken(userCreated._id), authCookieOptions);

        res.status(201).json({
            message : "User created Successfully",
            user : formatUser(userCreated)
        });
    }
    catch(err){
        console.log(err);
        return res.status(500).json({
            message : "Internal Server error"
        })
    }
}

export const login = async (req, res)=>{
    try{
        const result = loginSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const {email, password} = result.data;

        // password is select false in the schema, so it has to be asked for here
        const existingUser = await User.findOne({email}).select("+password");

        const isMatch = await bcrypt.compare(password, existingUser?.password ?? await getDummyHash());

        // same message for "no such email" and "wrong password", the caller cannot tell them apart
        if(!existingUser || !isMatch){
            return res.status(401).json({
                message : "Invalid Credentials"
            });
        }

        res.cookie(authCookieName, createToken(existingUser._id), authCookieOptions);

        res.status(200).json({
            message : "User Logged in Successfully",
            user : formatUser(existingUser)
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

// Logout only removes the cookie from the browser. The token itself stays valid until it
// expires (a known trade-off of JWT), but the browser no longer has it.
export const logout = async (req, res)=>{
    res.clearCookie(authCookieName, authCookieOptions);

    res.status(200).json({
        message : "User Logged Out Successfully"
    })
}

// The frontend calls this on page load to find out if the browser has a valid login.
export const profile = async (req, res)=>{
    return res.status(200).json({
        message : "Your profile",
        user : formatUser(req.user)
    });
}

export const updateProfile = async (req, res)=>{
    try{
        const result = updateProfileSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        // only the name can be changed here, email and password need extra checks
        // (typing the password again, verifying the new email) so they are not offered yet
        req.user.name = result.data.name;
        await req.user.save();

        res.status(200).json({
            message : "Profile updated Successfully",
            user : formatUser(req.user)
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}
