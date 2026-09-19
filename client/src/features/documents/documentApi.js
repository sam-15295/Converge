import { apiRequest } from "../../services/api";

// One function per document endpoint. Each returns the JSON body; errors are thrown as ApiClientError.
const base = (workspaceId)=> `/workspace/${workspaceId}/documents`;

export const getDocuments = (workspaceId, signal)=> apiRequest(base(workspaceId), { signal });
export const createDocument = (workspaceId, fields)=> apiRequest(base(workspaceId), { method: "POST", body: fields });
export const getDocument = (workspaceId, documentId, signal) =>
    apiRequest(`${base(workspaceId)}/${documentId}`, { signal });
export const renameDocument = (workspaceId, documentId, title) =>
    apiRequest(`${base(workspaceId)}/${documentId}`, { method: "PATCH", body: { title } });
export const deleteDocument = (workspaceId, documentId) =>
    apiRequest(`${base(workspaceId)}/${documentId}`, { method: "DELETE" });

// `version` is the version this content is based on. A 409 means somebody else saved in the meantime.
export const saveContent = (workspaceId, documentId, { content, version }) =>
    apiRequest(`${base(workspaceId)}/${documentId}/content`, { method: "PUT", body: { content, version } });
