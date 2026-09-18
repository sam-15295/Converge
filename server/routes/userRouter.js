import express from "express";
import {login, signup, profile, logout, updateProfile} from "../controllers/userController.js";
import authUserMiddleware from "../middlewares/authUserMiddleware.js";
import authRateLimitMiddleware from "../middlewares/authRateLimitMiddleware.js";

const userRouter = express.Router();

// read every line left to right, that is the order the request passes through
userRouter.post("/signup", authRateLimitMiddleware, signup);
userRouter.post("/login", authRateLimitMiddleware, login);
userRouter.post("/logout", logout);
userRouter.get("/profile", authUserMiddleware, profile);
userRouter.patch("/profile", authUserMiddleware, updateProfile);

export default userRouter;
