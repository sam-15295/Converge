import * as z from "zod";
import {allowedReactions} from "../config/reactions.js";

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

// A chat message is plain text. It is stored and shown as text (React escapes it), never as HTML.
export const sendMessageSchema = z.object({
    content : z.string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(4000, "Message is too long (at most 4000 characters)")
    .refine((val)=> !val.includes("\u0000"), "Message contains an invalid character"),

    // set when this message is a reply in a thread
    parentMessageId : objectIdSchema.nullish()
});

// ?limit=30&before=<messageId>   or   ?after=<messageId>
export const listMessagesQuerySchema = z.object({
    limit : z.coerce.number().int().min(1, "limit must be at least 1").max(50, "limit can be at most 50").default(30),
    before : objectIdSchema.optional(),
    after : objectIdSchema.optional()
}).refine((val)=> !(val.before && val.after), "Use either before or after, not both");

export const reactionParamsSchema = z.object({
    emoji : z.enum(allowedReactions, {error : "This reaction is not available"})
});
