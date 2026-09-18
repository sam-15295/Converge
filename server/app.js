import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import env from "./config/env.js";
import requestLoggerMiddleware from "./middlewares/requestLoggerMiddleware.js";
import verifyOriginMiddleware from "./middlewares/verifyOriginMiddleware.js";
import notFoundMiddleware from "./middlewares/notFoundMiddleware.js";
import errorMiddleware from "./middlewares/errorMiddleware.js";
import healthRouter from "./routes/healthRouter.js";
import userRouter from "./routes/userRouter.js";
import workspaceRouter from "./routes/workspaceRouter.js";

// The app is built here and started in index.js, so it can be imported
// (for example by a test) without opening a port.
const app = express();

// the order matters, a request goes through these from top to bottom
if(env.NODE_ENV !== "test"){
    app.use(requestLoggerMiddleware);
}
app.use(helmet());
app.use(cors({origin : env.CLIENT_URL, credentials : true}));   // credentials : the browser may send the login cookie
app.use(express.json({limit : "100kb"}));
app.use(cookieParser());
app.use("/api", verifyOriginMiddleware);

// every route lives under /api
app.use("/api/health", healthRouter);
app.use("/api/user", userRouter);
app.use("/api/workspace", workspaceRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
