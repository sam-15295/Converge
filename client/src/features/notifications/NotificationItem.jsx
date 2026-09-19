import { timeAgo } from "../../utils/formatTime";

// One notification. The whole row is a button : clicking it opens the source (the chat at that message, or the document
// at that comment).
// The names and the preview are shown as text, never as HTML.
// A sender or workspace that no longer exists is shown as "Someone" / "a workspace", and a message that is gone as no preview.
const NotificationItem = ({ notification, onOpen, compact = false })=>{
    const { sender, workspace, preview, read, createdAt } = notification;
    const inDocument = notification.sourceType === "COMMENT";

    return (
        <li>
            <button
                type="button"
                onClick={()=> onOpen(notification)}
                className={`flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 ${read ? "" : "bg-blue-50"}`}
            >
                <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${read ? "bg-transparent" : "bg-blue-600"}`}
                />
                <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-900">
                        <span className="font-medium">{sender.name ?? "Someone"}</span> mentioned you in{" "}
                        {inDocument ? (
                            <>
                                a comment on <span className="font-medium">{notification.document?.title ?? "a document"}</span>
                            </>
                        ) : (
                            <span className="font-medium">{workspace.name ?? "a workspace"}</span>
                        )}
                    </span>
                    {preview && (
                        <span className={`mt-0.5 block text-sm text-slate-600 ${compact ? "truncate" : "line-clamp-2"}`}>
                            {preview.content}
                        </span>
                    )}
                    <span className="mt-0.5 block text-xs text-slate-500">
                        {inDocument && <>{workspace.name ?? "a workspace"} · </>}
                        <time dateTime={createdAt}>{timeAgo(createdAt)}</time>
                    </span>
                </span>
                {!read && <span className="sr-only">unread</span>}
            </button>
        </li>
    );
}

export default NotificationItem;
