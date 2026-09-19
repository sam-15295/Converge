import { apiRequest } from "../../services/api";
import { withQuery } from "../../utils/withQuery";

// One function per version endpoint. Each returns the JSON body; errors are thrown as ApiClientError.
const base = (workspaceId, documentId)=> `/workspace/${workspaceId}/documents/${documentId}/versions`;

// The history of a document, newest first. params : { limit, before (the id of the last one the page has) }
export const getVersions = (workspaceId, documentId, params, signal)=>
    apiRequest(withQuery(base(workspaceId, documentId), params), { signal });

// One version with the text it holds (as the tree the editor uses, never HTML)
export const getVersion = (workspaceId, documentId, versionId, signal)=>
    apiRequest(`${base(workspaceId, documentId)}/${versionId}`, { signal });

// Puts that version back into the document. Everybody who has it open sees the change at once.
export const restoreVersion = (workspaceId, documentId, versionId)=>
    apiRequest(`${base(workspaceId, documentId)}/${versionId}/restore`, { method: "POST" });
