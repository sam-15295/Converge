import Message from "../model/messageSchema.js";
import {allowedReactions} from "../config/reactions.js";

// The reactions of a message as a list, in the order of the palette : [{emoji, userIds}]
// (empty ones are left out, and only emoji from the allowed list are ever shown)
const formatReactions = (reactions)=>{
    return allowedReactions
    .filter((emoji)=> Array.isArray(reactions?.[emoji]) && reactions[emoji].length > 0)
    .map((emoji)=> ({emoji, userIds : reactions[emoji].map(String)}));
}

const asText = (value)=> value === null || value === undefined ? null : String(value);
const asIsoDate = (value)=> value ? new Date(value).toISOString() : null;

// What is sent to clients (REST responses AND socket events). The sender's name must be loaded (populated) first.
// Everything is turned into plain JSON values here (ids as text, dates as ISO text), so the same object is a
// correct REST response AND a correct socket event, whatever the serializer does with ObjectId or Date objects.
export const formatMessage = (message)=>{
    const sender = message.senderId;

    return {
        id : String(message._id),
        sender : {id : String(sender?._id ?? sender), name : sender?.name},
        content : message.content,
        mentions : (message.mentions ?? []).map((mention)=> ({userId : String(mention.userId), displayName : mention.displayName})),
        parentMessageId : asText(message.parentMessageId),
        replyCount : message.replyCount,
        lastReplyAt : asIsoDate(message.lastReplyAt),
        reactions : formatReactions(message.reactions),
        createdAt : asIsoDate(message.createdAt)
    };
}

// Loads the sender's name if it is not loaded yet, then formats
export const loadAndFormat = async (message)=>{
    if(!message.populated("senderId")){
        await message.populate("senderId", "name");
    }
    return formatMessage(message);
}

// One page of messages, read with a CURSOR instead of page numbers.
//   nothing        the latest `limit` messages
//   before = id    the `limit` messages before that one (scrolling up into the history)
//   after  = id    the messages after that one, oldest first (catching up after being offline)
// Page numbers would break as soon as a new message arrives while somebody scrolls : everything would shift and
// messages would repeat or vanish. A cursor always means "right after / right before THIS message".
// Sorting by (createdAt, _id) makes the order strict even for messages created in the same millisecond.
//
// Returns { messages, hasMore } with the messages in chronological order (oldest first), or null when the cursor
// message does not exist in this chat. `parentMessageId` null = the main chat, an id = the replies of that message.
export const findPage = async ({workspaceId, parentMessageId, before, after, limit})=>{
    const filter = {workspaceId, parentMessageId};
    const cursorId = before ?? after;

    if(cursorId){
        // the cursor must belong to the SAME chat (or thread), so an id from another workspace is simply "not found"
        const cursor = await Message.findOne({_id : cursorId, workspaceId, parentMessageId}).select("createdAt");

        if(!cursor){
            return null;
        }

        const operator = before ? "$lt" : "$gt";
        filter.$or = [
            {createdAt : {[operator] : cursor.createdAt}},
            {createdAt : cursor.createdAt, _id : {[operator] : cursor._id}}
        ];
    }

    const newestFirst = !after;     // the latest page and "before" pages are read backwards from the newest
    const direction = newestFirst ? -1 : 1;

    // one extra message tells us whether there is more, without a second query
    const found = await Message.find(filter)
    .populate("senderId", "name")
    .sort({createdAt : direction, _id : direction})
    .limit(limit + 1);

    const hasMore = found.length > limit;
    const messages = found.slice(0, limit);

    if(newestFirst){
        messages.reverse();
    }

    return {messages, hasMore};
}
