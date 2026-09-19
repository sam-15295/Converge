import * as z from "zod";

const titleSchema = z.string()
.trim()
.min(1, "Document title is required")
.max(100, "Length cannot be greater than 100 chars");

export const createDocumentSchema = z.object({
    title : titleSchema
});

export const renameDocumentSchema = z.object({
    title : titleSchema
});
