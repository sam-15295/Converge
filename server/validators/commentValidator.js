import * as z from "zod";
import {mentionsSchema} from "./mentionValidator.js";

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

// A comment is plain text. It is stored and shown as text (React escapes it), never as HTML.
export const createCommentSchema = z.object({
    content : z.string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment is too long (at most 2000 characters)")
    .refine((val)=> !val.includes("\u0000"), "Comment contains an invalid character"),

    // set when this comment answers a thread
    parentCommentId : objectIdSchema.nullish(),

    mentions : mentionsSchema
});

// ?status=open|resolved|all&limit=30&before=<threadId>
export const listCommentsQuerySchema = z.object({
    status : z.enum(["open", "resolved", "all"], {error : "status must be open, resolved or all"}).default("open"),
    limit : z.coerce.number().int().min(1, "limit must be at least 1").max(50, "limit can be at most 50").default(30),

    // the page BEFORE this thread (older ones), like the chat history
    before : objectIdSchema.optional()
});
