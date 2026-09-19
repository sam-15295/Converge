import mongoose from "mongoose";
import Notification from "../model/notificationSchema.js";
import appEvents from "../events/appEvents.js";
import {listNotificationsQuerySchema} from "../validators/notificationValidator.js";
import formatZodErrors from "../validators/formatZodErrors.js";
import {countUnread, findNotificationPage, formatNotifications, memberWorkspaceIds} from "../service/notificationService.js";

// A notification belongs to ONE person. Every query below starts from "recipientId is the logged in user", so somebody else's
// notification is simply "not found", and only workspaces the person is still a member of are ever included.

export const listNotifications = async (req, res)=>{
    try{
        const result = listNotificationsQuerySchema.safeParse(req.query);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const {limit, before, unread, workspaceId} = result.data;
        const mine = (await memberWorkspaceIds(req.user._id)).map(String);

        // "only this workspace" can only narrow down what the person may see : a workspace they are not in gives an empty list
        const workspaceIds = workspaceId ? mine.filter((id)=> id === workspaceId.toLowerCase()) : mine;

        const page = await findNotificationPage({userId : req.user._id, workspaceIds, unreadOnly : Boolean(unread), before, limit});

        if(!page){
            return res.status(404).json({
                message : "Notification not found"
            });
        }

        res.status(200).json({
            message : "Notifications",
            notifications : await formatNotifications(page.notifications),
            hasMore : page.hasMore,
            unreadCount : await countUnread(req.user._id)
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const getUnreadCount = async (req, res)=>{
    try{
        res.status(200).json({
            message : "Unread notifications",
            unreadCount : await countUnread(req.user._id)
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const markNotificationRead = async (req, res)=>{
    try{
        const {notificationId} = req.params;

        if(!mongoose.isValidObjectId(notificationId)){
            return res.status(404).json({
                message : "Notification not found"
            });
        }

        const workspaceIds = await memberWorkspaceIds(req.user._id);
        const mine = {_id : notificationId, recipientId : req.user._id, workspaceId : {$in : workspaceIds}};

        // only the FIRST time sets readAt : reading it again changes nothing (so it is safe to repeat)
        await Notification.updateOne({...mine, read : false}, {$set : {read : true, readAt : new Date()}});
        const notification = await Notification.findOne(mine);

        if(!notification){
            return res.status(404).json({
                message : "Notification not found"
            });
        }

        const unreadCount = await countUnread(req.user._id);

        // other tabs of the same person show the new count (the socket layer listens)
        appEvents.emit("notification:read", {recipientId : String(req.user._id), notificationId : String(notification._id), unreadCount});

        res.status(200).json({
            message : "Notification marked as read",
            notification : (await formatNotifications([notification]))[0],
            unreadCount
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const markAllNotificationsRead = async (req, res)=>{
    try{
        const workspaceIds = await memberWorkspaceIds(req.user._id);

        const result = await Notification.updateMany(
            {recipientId : req.user._id, read : false, workspaceId : {$in : workspaceIds}},
            {$set : {read : true, readAt : new Date()}}
        );
        const unreadCount = await countUnread(req.user._id);

        appEvents.emit("notification:read-all", {recipientId : String(req.user._id), unreadCount});

        res.status(200).json({
            message : "All notifications marked as read",
            updated : result.modifiedCount,
            unreadCount
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}
