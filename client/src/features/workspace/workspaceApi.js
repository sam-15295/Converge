import { apiRequest } from "../../services/api";

// One function per workspace endpoint. Each returns the JSON body; errors are thrown as ApiClientError.

// ---------- workspaces ----------
export const getMyWorkspaces = (signal)=> apiRequest("/workspace", { signal });
export const createWorkspace = (fields)=> apiRequest("/workspace", { method: "POST", body: fields });
export const getWorkspace = (id, signal)=> apiRequest(`/workspace/${id}`, { signal });
export const updateWorkspace = (id, fields)=> apiRequest(`/workspace/${id}`, { method: "PATCH", body: fields });
export const deleteWorkspace = (id)=> apiRequest(`/workspace/${id}`, { method: "DELETE" });
export const leaveWorkspace = (id)=> apiRequest(`/workspace/${id}/leave`, { method: "POST" });

// ---------- members ----------
export const getMembers = (id, signal)=> apiRequest(`/workspace/${id}/members`, { signal });
export const changeMemberRole = (id, userId, role) =>
    apiRequest(`/workspace/${id}/members/${userId}`, { method: "PATCH", body: { role } });
export const removeMember = (id, userId)=> apiRequest(`/workspace/${id}/members/${userId}`, { method: "DELETE" });

// ---------- invitations of a workspace (OWNER and ADMIN) ----------
export const getWorkspaceInvites = (id, signal)=> apiRequest(`/workspace/${id}/invites`, { signal });
export const createInvite = (id, fields)=> apiRequest(`/workspace/${id}/invites`, { method: "POST", body: fields });
export const cancelInvite = (id, inviteId)=> apiRequest(`/workspace/${id}/invites/${inviteId}`, { method: "DELETE" });

// ---------- invitations addressed to the logged in user ----------
export const getMyInvites = (signal)=> apiRequest("/invite", { signal });
export const acceptInvite = (inviteId)=> apiRequest(`/invite/${inviteId}/accept`, { method: "POST" });
export const declineInvite = (inviteId)=> apiRequest(`/invite/${inviteId}/decline`, { method: "POST" });
