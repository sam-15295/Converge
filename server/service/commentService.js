import Comment from "../model/commentSchema.js";
import {deleteNotificationsOf} from "./notificationService.js";

const asText = (value)=> value === null || value === undefined ? null : String(value);
const asIsoDate = (value)=> value ? new Date(value).toISOString() : null;

// The names of the author and of the person who resolved the thread are loaded (populated) with the comment
const people = "name";

// What is sent to clients (REST responses AND socket events) : plain JSON values only (ids as text, dates as ISO text).
export const formatComment = (comment)=>{
    const author = comment.authorId;
    const resolver = comment.resolvedBy;

    return {
        id : String(comment._id),
        documentId : String(comment.documentId),
        author : {id : String(author?._id ?? author), name : author?.name ?? null},
        content : comment.content,
        mentions : (comment.mentions ?? []).map((mention)=> ({userId : String(mention.userId), displayName : mention.displayName})),
        parentCommentId : asText(comment.parentCommentId),
        resolved : comment.resolved,
        resolvedBy : comment.resolved && resolver ? {id : String(resolver._id ?? resolver), name : resolver.name ?? null} : null,
        resolvedAt : asIsoDate(comment.resolvedAt),
        createdAt : asIsoDate(comment.createdAt)
    };
}

// Loads the names if they are not loaded yet, then formats
export const loadAndFormat = async (comment)=>{
    if(!comment.populated("authorId")){
        await comment.populate("authorId", people);
    }
    if(comment.resolvedBy && !comment.populated("resolvedBy")){
        await comment.populate("resolvedBy", people);
    }
    return formatComment(comment);
}

const withReplies = (topLevel, replies)=>{
    const byThread = new Map();

    for(const reply of replies){
        const key = String(reply.parentCommentId);
        byThread.set(key, [...(byThread.get(key) ?? []), formatComment(reply)]);
    }
    return topLevel.map((comment)=> ({...formatComment(comment), replies : byThread.get(String(comment._id)) ?? []}));
}

// The threads of a document, newest first, read with a CURSOR (the id of the last thread the client has), for the same
// reason as the chat history : page numbers shift when something new arrives. Every thread comes with ALL its replies
// (oldest first), read with one query for the whole page.
//   status : "open" | "resolved" | "all"
// Returns {threads, hasMore}, or null when the cursor is not a thread of this document.
export const findThreads = async ({documentId, status, before, limit})=>{
    const filter = {documentId, parentCommentId : null};

    if(status === "open"){
        filter.resolved = false;
    }
    if(status === "resolved"){
        filter.resolved = true;
    }

    if(before){
        // the cursor is looked up WITHOUT the status : it may have been resolved since it was shown
        const cursor = await Comment.findOne({_id : before, documentId, parentCommentId : null}).select("createdAt");

        if(!cursor){
            return null;
        }
        filter.$or = [
            {createdAt : {$lt : cursor.createdAt}},
            {createdAt : cursor.createdAt, _id : {$lt : cursor._id}}
        ];
    }

    // one extra tells whether there is more, without a second query
    const found = await Comment.find(filter)
    .populate("authorId", people)
    .populate("resolvedBy", people)
    .sort({createdAt : -1, _id : -1})
    .limit(limit + 1);

    const topLevel = found.slice(0, limit);
    const replies = await Comment.find({parentCommentId : {$in : topLevel.map((comment)=> comment._id)}})
    .populate("authorId", people)
    .sort({createdAt : 1, _id : 1});

    return {threads : withReplies(topLevel, replies), hasMore : found.length > limit};
}

// One thread (its first comment and all replies), or null. Only the FIRST comment of a thread names a thread.
export const findThread = async (documentId, commentId)=>{
    const topLevel = await Comment.findOne({_id : commentId, documentId, parentCommentId : null})
    .populate("authorId", people)
    .populate("resolvedBy", people);

    if(!topLevel){
        return null;
    }

    const replies = await Comment.find({parentCommentId : topLevel._id})
    .populate("authorId", people)
    .sort({createdAt : 1, _id : 1});

    return withReplies([topLevel], replies)[0];
}

// Deletes comments, and the notifications about them (a notification about a comment that is gone would lead nowhere).
// Returns the people whose unread count changed.
export const removeComments = async (commentIds)=>{
    await Comment.deleteMany({_id : {$in : commentIds}});
    return deleteNotificationsOf("COMMENT", commentIds);
}

// All the comments of a document (when the document is deleted)
export const removeCommentsOfDocument = async (documentId)=>{
    const ids = await Comment.find({documentId}).distinct("_id");
    return ids.length > 0 ? removeComments(ids) : [];
}

// how many threads of the document are still open (the number on the comments button)
export const countOpenThreads = (documentId)=>{
    return Comment.countDocuments({documentId, parentCommentId : null, resolved : false});
}
