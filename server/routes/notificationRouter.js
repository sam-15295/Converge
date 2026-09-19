import express from "express";
import {listNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead} from "../controllers/notificationController.js";
import authUserMiddleware from "../middlewares/authUserMiddleware.js";
import notificationRateLimitMiddleware from "../middlewares/notificationRateLimitMiddleware.js";

// "MY notifications". There is no workspace in these URLs : the inbox lists what happened to the logged in person in
// all their workspaces. Which ones they may see is decided inside (their current memberships), not by a URL.
const notificationRouter = express.Router();

notificationRouter.use(authUserMiddleware);
notificationRouter.use(notificationRateLimitMiddleware);

notificationRouter.get("/", listNotifications);
notificationRouter.get("/unread-count", getUnreadCount);
notificationRouter.post("/read-all", markAllNotificationsRead);
notificationRouter.patch("/:notificationId/read", markNotificationRead);

export default notificationRouter;
