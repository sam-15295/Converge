import * as z from "zod";
import {assignableRoles} from "../config/permissions.js";

const nameSchema = z.string()
.trim()
.min(1, "Workspace name is required")
.max(50, "Length cannot be greater than 50 chars");

const descriptionSchema = z.string()
.trim()
.max(200, "Description cannot be greater than 200 chars");

export const createWorkspaceSchema = z.object({
    name : nameSchema,
    description : descriptionSchema.optional()
});

export const updateWorkspaceSchema = z.object({
    name : nameSchema.optional(),
    description : descriptionSchema.optional()
}).refine((val)=> val.name !== undefined || val.description !== undefined, "Send a name or a description to update");

// OWNER is not in this list on purpose : the owner is the creator, and ownership cannot be handed out
export const changeRoleSchema = z.object({
    role : z.enum(assignableRoles, {error : "Role must be ADMIN, MEMBER or VIEWER"})
});
