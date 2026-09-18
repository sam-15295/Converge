import * as z from "zod";

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
