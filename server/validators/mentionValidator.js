import * as z from "zod";

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

// A text (a message, a comment) can mention this many people at most (every mention becomes a notification)
export const maxMentions = 20;

// Only WHO is meant is taken from the client. The name comes from our own data (see mentionService),
// so any displayName the client sends is dropped here.
export const mentionsSchema = z.array(z.object({userId : objectIdSchema}))
.max(maxMentions, `You can mention at most ${maxMentions} people in one text`)
.nullish();
