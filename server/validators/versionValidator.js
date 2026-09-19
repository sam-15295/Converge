import * as z from "zod";

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

// ?limit=20&before=<versionId>
export const listVersionsQuerySchema = z.object({
    limit : z.coerce.number().int().min(1, "limit must be at least 1").max(50, "limit can be at most 50").default(20),

    // the page BEFORE this version (older ones), like the chat history and the comments
    before : objectIdSchema.optional()
});
