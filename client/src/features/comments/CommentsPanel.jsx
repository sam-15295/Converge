import { useRef, useState } from "react";
import MentionComposer from "../mentions/MentionComposer";
import { useFocusScroll } from "../../hooks/useFocusScroll";
import CommentThread from "./CommentThread";
import { useCommentsContext } from "./CommentsContext";
import { commentMaxLength } from "./commentsState";

// The comments of the open document, next to the editor : a box to start a thread, the threads (Open or Resolved), and
// the thread a link pointed at, highlighted at the top.
const CommentsPanel = ()=>{
    const comments = useCommentsContext();
    const { threads, hasMore, loaded, status, openCount, canComment, connection, notice, problem, linked, linkNotice, members } = comments;
    const listRef = useRef(null);
    const [loadingMore, setLoadingMore] = useState(false);

    // a link : scroll to the comment it pointed at (inside the panel, never the whole page)
    useFocusScroll(listRef, linked ? { id: linked.replyId ?? linked.thread.id, token: linked.token } : null, "comment");

    const showMore = async ()=>{
        setLoadingMore(true);
        await comments.loadMore();
        setLoadingMore(false);
    }

    const tab = (label, value)=> (
        <button
            type="button"
            aria-pressed={status === value}
            onClick={()=> status !== value && comments.showStatus(value)}
            className={`rounded-md px-3 py-1 text-sm ${status === value ? "bg-primary text-white" : "text-body hover:bg-raised"}`}
        >
            {label}
        </button>
    );

    if(connection === "denied"){
        return (
            <aside aria-label="Comments" className="rounded-lg border border-danger-line bg-danger-bg px-4 py-6 text-center text-sm text-danger">
                <p role="alert">{notice}</p>
            </aside>
        );
    }

    // the linked thread is shown at the top, so it is not repeated in the list
    const listed = linked ? threads.filter((thread)=> thread.id !== linked.thread.id) : threads;

    return (
        <aside aria-label="Comments" className="flex max-h-[calc(100dvh-8rem)] min-h-0 flex-col rounded-lg border border-line bg-raised shadow-sm">
            <header className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2 rounded-t-lg">
                <h2 className="font-semibold text-strong">Comments</h2>
                <span className="text-sm text-muted">{openCount} open</span>
            </header>

            <div className="border-b border-line bg-surface p-3">
                <MentionComposer
                    label="Write a comment"
                    placeholder="Comment on this document…  (@ mentions somebody)"
                    members={members}
                    maxLength={commentMaxLength}
                    disabledReason={
                        connection !== "connected" && canComment
                            ? "You are offline, comments cannot be sent right now."
                            : !canComment
                              ? "You can read the comments but not write in them."
                              : null
                    }
                    onSend={(content, mentions)=> comments.write(content, undefined, mentions)}
                />
            </div>

            {connection !== "connected" && (
                <p role="status" className="border-b border-warn-line bg-warn-bg px-3 py-2 text-sm text-warn">
                    {connection === "connecting" ? "Connecting…" : "You are offline. Trying to reconnect : what you missed will appear when you are back."}
                </p>
            )}

            {problem && (
                <p role="alert" className="flex items-center justify-between gap-2 border-b border-danger-line bg-danger-bg px-3 py-2 text-sm text-danger">
                    <span>{problem}</span>
                    <button type="button" onClick={comments.dismissProblem} className="font-medium underline">
                        Dismiss
                    </button>
                </p>
            )}

            {linkNotice && (
                <p role="alert" className="flex items-center justify-between gap-2 border-b border-warn-line bg-warn-bg px-3 py-2 text-sm text-warn">
                    <span>{linkNotice}</span>
                    <button type="button" onClick={comments.clearLinked} className="font-medium underline">
                        Dismiss
                    </button>
                </p>
            )}

            <div className="flex gap-1 border-b border-line bg-surface px-3 py-2" role="group" aria-label="Which threads">
                {tab("Open", "open")}
                {tab("Resolved", "resolved")}
            </div>

            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {linked && (
                    <section aria-label="Linked comment">
                        <p className="mb-1 flex items-center justify-between text-xs font-medium tracking-wide text-muted uppercase">
                            <span>Linked comment</span>
                            <button type="button" onClick={comments.clearLinked} className="normal-case underline">
                                Close
                            </button>
                        </p>
                        <ul>
                            <CommentThread thread={linked.thread} highlight={{ id: linked.replyId ?? linked.thread.id, token: linked.token }} />
                        </ul>
                    </section>
                )}

                {!loaded && !problem && <p className="py-4 text-center text-sm text-muted">Loading comments…</p>}
                {loaded && listed.length === 0 && !linked && (
                    <p className="py-4 text-center text-sm text-muted">
                        {status === "open" ? "No open comments." : "No resolved comments."}
                    </p>
                )}

                <ul aria-label={status === "open" ? "Open threads" : "Resolved threads"} className="space-y-3">
                    {listed.map((thread)=> (
                        <CommentThread key={thread.id} thread={thread} highlight={null} />
                    ))}
                </ul>

                {hasMore && (
                    <div className="text-center">
                        <button
                            type="button"
                            disabled={loadingMore}
                            onClick={showMore}
                            className="rounded-md border border-line-strong bg-surface px-3 py-1 text-sm text-body hover:bg-raised disabled:opacity-50"
                        >
                            {loadingMore ? "Loading…" : "Load more"}
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}

export default CommentsPanel;
