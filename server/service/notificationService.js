import Notification from "../model/notificationSchema.js";
import WorkspaceMember from "../model/workspaceMemberSchema.js";
import Workspace from "../model/workspaceSchema.js";
import User from "../model/userSchema.js";
import Message from "../model/messageSchema.js";

const previewLength = 140;

// the first characters of a text, cut on whole characters (an emoji is never cut in half)
const snippet = (text)=>{
    const characters = Array.from(text);
    return characters.length > previewLength ? characters.slice(0, previewLength).join("") + "…" : text;
}

// The workspaces this person belongs to RIGHT NOW. Everything about notifications is limited to these, so somebody
// who left a workspace stops seeing what was said there (the notifications stay in the database, hidden).
export const memberWorkspaceIds = async (userId)=>{
    return WorkspaceMember.find({userId}).distinct("workspaceId");
}

export const countUnread = async (userId)=>{
    const workspaceIds = await memberWorkspaceIds(userId);
    return Notification.countDocuments({recipientId : userId, read : false, workspaceId : {$in : workspaceIds}});
}

// Saves the notification, or returns null when this person was already notified about this source
// (the unique index decides, so it also holds for two events at the same moment).
export const createNotification = async ({type, recipientId, senderId, workspaceId, sourceType, sourceId})=>{
    try{
        return await Notification.create({type, recipientId, senderId, workspaceId, sourceType, sourceId});
    }
    catch(err){
        if(err.code === 11000){
            return null;
        }
        throw err;
    }
}

// What is sent to clients (REST and sockets). The notification only holds ids, so the names, the workspace and a preview
// of the message are looked up here : three queries for the whole list, not three per notification.
export const formatNotifications = async (notifications)=>{
    if(notifications.length === 0){
        return [];
    }

    const unique = (values)=> [...new Set(values.map(String))];
    const [senders, workspaces, messages] = await Promise.all([
        User.find({_id : {$in : unique(notifications.map((notification)=> notification.senderId))}}).select("name"),
        Workspace.find({_id : {$in : unique(notifications.map((notification)=> notification.workspaceId))}}).select("name"),
        Message.find({_id : {$in : unique(notifications.filter((notification)=> notification.sourceType === "MESSAGE").map((notification)=> notification.sourceId))}}).select("content parentMessageId workspaceId")
    ]);

    const byId = (documents)=> new Map(documents.map((document)=> [String(document._id), document]));
    const senderOf = byId(senders);
    const workspaceOf = byId(workspaces);
    const messageOf = byId(messages);

    return notifications.map((notification)=>{
        const sender = senderOf.get(String(notification.senderId));
        const workspace = workspaceOf.get(String(notification.workspaceId));
        const message = messageOf.get(String(notification.sourceId));

        // A preview is only shown when the message really belongs to the workspace of the notification
        // (text from anywhere else is never shown through a notification).
        const showPreview = message && String(message.workspaceId) === String(notification.workspaceId);

        return {
            id : String(notification._id),
            type : notification.type,
            sourceType : notification.sourceType,
            sourceId : String(notification.sourceId),
            workspace : {id : String(notification.workspaceId), name : workspace?.name ?? null},
            sender : {id : String(notification.senderId), name : sender?.name ?? null},
            read : notification.read,
            createdAt : notification.createdAt.toISOString(),
            preview : showPreview ? {content : snippet(message.content), parentMessageId : message.parentMessageId ? String(message.parentMessageId) : null} : null
        };
    });
}
