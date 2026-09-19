import { apiRequest } from "../../services/api";
import { withQuery } from "../../utils/withQuery";

// One function per comment endpoint. Each returns the JSON body; errors are thrown as ApiClientError.
const base = (workspaceId, documentId)=> `/workspace/${workspaceId}/documents/${documentId}/comments`;

// The threads of a document, newest first, each with all its replies.
// params : { status: "open" | "resolved", limit, before (the id of the last thread the page has) }
export const getThreads = (workspaceId, documentId, params, signal)=>
    apiRequest(withQuery(base(workspaceId, documentId), params), { signal });

// One thread by the id of its first comment (a link from a notification points at it)
export const getThread = (workspaceId, documentId, commentId, signal)=>
    apiRequest(`${base(workspaceId, documentId)}/${commentId}`, { signal });

// A new thread, or a reply when parentCommentId is given. mentions : [{ userId }] (only WHO, the server adds the names)
export const createComment = (workspaceId, documentId, { content, parentCommentId, mentions })=>
    apiRequest(base(workspaceId, documentId), { method: "POST", body: { content, parentCommentId, mentions } });

export const resolveThread = (workspaceId, documentId, commentId)=>
    apiRequest(`${base(workspaceId, documentId)}/${commentId}/resolve`, { method: "POST" });

export const reopenThread = (workspaceId, documentId, commentId)=>
    apiRequest(`${base(workspaceId, documentId)}/${commentId}/reopen`, { method: "POST" });

export const deleteComment = (workspaceId, documentId, commentId)=>
    apiRequest(`${base(workspaceId, documentId)}/${commentId}`, { method: "DELETE" });
