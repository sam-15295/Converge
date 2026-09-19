import * as z from "zod";

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

// ?limit=20&before=<notificationId>&unread=true&workspaceId=<id>
export const listNotificationsQuerySchema = z.object({
    limit : z.coerce.number().int().min(1, "limit must be at least 1").max(50, "limit can be at most 50").default(20),

    // the page BEFORE this notification (older ones), like the chat history
    before : objectIdSchema.optional(),

    // only the unread ones (leave it out to get all of them)
    unread : z.enum(["true"], {error : "unread can only be true"}).optional(),

    // only what happened in this workspace
    workspaceId : objectIdSchema.optional()
});
