import Notification from "../model/notificationSchema.js";
import WorkspaceMember from "../model/workspaceMemberSchema.js";
import Workspace from "../model/workspaceSchema.js";
import User from "../model/userSchema.js";
import Message from "../model/messageSchema.js";
import Comment from "../model/commentSchema.js";
import Document from "../model/documentSchema.js";

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

// One page of a person's notifications, newest first, read with a CURSOR (the id of the last notification they have),
// for the same reason as the chat history : page numbers shift when something new arrives.
// Returns {notifications, hasMore}, or null when the cursor is not one of this person's visible notifications.
export const findNotificationPage = async ({userId, workspaceIds, unreadOnly, before, limit})=>{
    const filter = {recipientId : userId, workspaceId : {$in : workspaceIds}};

    if(before){
        // the cursor is looked up WITHOUT the unread filter : it may have been marked read since it was shown
        const cursor = await Notification.findOne({_id : before, recipientId : userId, workspaceId : {$in : workspaceIds}}).select("createdAt");

        if(!cursor){
            return null;
        }
        filter.$or = [
            {createdAt : {$lt : cursor.createdAt}},
            {createdAt : cursor.createdAt, _id : {$lt : cursor._id}}
        ];
    }
    if(unreadOnly){
        filter.read = false;
    }

    // one extra tells whether there is more, without a second query
    const found = await Notification.find(filter).sort({createdAt : -1, _id : -1}).limit(limit + 1);

    return {notifications : found.slice(0, limit), hasMore : found.length > limit};
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

// Deletes the notifications that point at things which no longer exist (deleted comments). Returns the people whose
// unread count changed, once each, so their bell can be told.
export const deleteNotificationsOf = async (sourceType, sourceIds)=>{
    const found = await Notification.find({sourceType, sourceId : {$in : sourceIds}}).select("recipientId");

    if(found.length === 0){
        return [];
    }

    await Notification.deleteMany({_id : {$in : found.map((notification)=> notification._id)}});
    return [...new Set(found.map((notification)=> String(notification.recipientId)))];
}

// What is sent to clients (REST and sockets). The notification only holds ids, so the names, the workspace and a preview
// of the message or comment are looked up here : a few queries for the whole list, not some per notification.
//
// A notification about a CHAT MESSAGE has  preview {content, parentMessageId}.
// A notification about a COMMENT has       preview {content, parentCommentId, documentId}  and  document {id, title}.
// Nothing is ever shown that belongs to another workspace than the notification (a forged notification shows nothing).
export const formatNotifications = async (notifications)=>{
    if(notifications.length === 0){
        return [];
    }

    const unique = (values)=> [...new Set(values.map(String))];
    const sourceIds = (sourceType)=> unique(notifications.filter((notification)=> notification.sourceType === sourceType).map((notification)=> notification.sourceId));

    const [senders, workspaces, messages, comments] = await Promise.all([
        User.find({_id : {$in : unique(notifications.map((notification)=> notification.senderId))}}).select("name"),
        Workspace.find({_id : {$in : unique(notifications.map((notification)=> notification.workspaceId))}}).select("name"),
        Message.find({_id : {$in : sourceIds("MESSAGE")}}).select("content parentMessageId workspaceId"),
        Comment.find({_id : {$in : sourceIds("COMMENT")}}).select("content parentCommentId documentId workspaceId")
    ]);

    // the documents the comments are on (for their titles)
    const documents = await Document.find({_id : {$in : unique(comments.map((comment)=> comment.documentId))}}).select("title workspaceId");

    const byId = (list)=> new Map(list.map((item)=> [String(item._id), item]));
    const senderOf = byId(senders);
    const workspaceOf = byId(workspaces);
    const messageOf = byId(messages);
    const commentOf = byId(comments);
    const documentOf = byId(documents);

    return notifications.map((notification)=>{
        const sender = senderOf.get(String(notification.senderId));
        const workspace = workspaceOf.get(String(notification.workspaceId));
        const inThisWorkspace = (thing)=> thing && String(thing.workspaceId) === String(notification.workspaceId);

        const shown = {
            id : String(notification._id),
            type : notification.type,
            sourceType : notification.sourceType,
            sourceId : String(notification.sourceId),
            workspace : {id : String(notification.workspaceId), name : workspace?.name ?? null},
            sender : {id : String(notification.senderId), name : sender?.name ?? null},
            read : notification.read,
            createdAt : notification.createdAt.toISOString()
        };

        if(notification.sourceType === "COMMENT"){
            const comment = commentOf.get(String(notification.sourceId));
            const commentShown = inThisWorkspace(comment);
            const document = commentShown ? documentOf.get(String(comment.documentId)) : null;

            shown.preview = commentShown ? {
                content : snippet(comment.content),
                parentCommentId : comment.parentCommentId ? String(comment.parentCommentId) : null,
                documentId : String(comment.documentId)
            } : null;
            shown.document = inThisWorkspace(document) ? {id : String(document._id), title : document.title} : null;
            return shown;
        }

        // A preview is only shown when the message really belongs to the workspace of the notification
        // (text from anywhere else is never shown through a notification).
        const message = messageOf.get(String(notification.sourceId));

        shown.preview = inThisWorkspace(message)
            ? {content : snippet(message.content), parentMessageId : message.parentMessageId ? String(message.parentMessageId) : null}
            : null;
        return shown;
    });
}
