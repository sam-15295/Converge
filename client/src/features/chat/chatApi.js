import { apiRequest } from "../../services/api";

// One function per chat endpoint. Each returns the JSON body; errors are thrown as ApiClientError.
const base = (workspaceId)=> `/workspace/${workspaceId}/messages`;

// The emoji a message can be reacted with. The server has the same list and refuses anything else.
export const reactionOptions = ["👍", "❤️", "😂", "🎉", "😮", "😢", "🙏", "👀"];

const withQuery = (path, params)=>{
    const query = new URLSearchParams();
    for(const [key, value] of Object.entries(params ?? {})){
        if(value !== undefined && value !== null) query.set(key, value);
    }
    const text = query.toString();
    return text ? `${path}?${text}` : path;
}

// the main chat : the latest messages, or a page `before` / `after` a message (cursor paging)
export const getMessages = (workspaceId, params, signal)=> apiRequest(withQuery(base(workspaceId), params), { signal });

// the replies (thread) of one message
export const getReplies = (workspaceId, messageId, params, signal)=>
    apiRequest(withQuery(`${base(workspaceId)}/${messageId}/replies`, params), { signal });

// a normal message, or a reply when parentMessageId is given. mentions : [{ userId }] (only WHO, the server adds the names)
export const sendMessage = (workspaceId, { content, parentMessageId, mentions })=>
    apiRequest(base(workspaceId), { method: "POST", body: { content, parentMessageId, mentions } });

// the emoji goes in the URL, so it has to be encoded
export const addReaction = (workspaceId, messageId, emoji)=>
    apiRequest(`${base(workspaceId)}/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: "PUT" });

export const removeReaction = (workspaceId, messageId, emoji)=>
    apiRequest(`${base(workspaceId)}/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: "DELETE" });
