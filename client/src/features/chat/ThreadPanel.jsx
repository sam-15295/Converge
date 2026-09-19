import { useState } from "react";
import MessageComposer from "./MessageComposer";
import MessageItem from "./MessageItem";
import { useMessageScroll } from "./useMessageScroll";

// The replies to one message, next to the main chat. There is only ever one level of replies : a reply cannot be
// answered again, so nothing here has a "Reply" button.
const ThreadPanel = ({ chat, parent, currentUserId, canReact, names, members })=>{
    const { thread } = chat;
    const { listRef, handleScroll } = useMessageScroll(thread.messages, currentUserId);
    const [loadingOlder, setLoadingOlder] = useState(false);

    const showOlder = async ()=>{
        setLoadingOlder(true);
        await chat.loadOlderReplies();
        setLoadingOlder(false);
    }

    return (
        <aside aria-label="Thread" className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 className="font-semibold text-slate-900">Thread</h2>
                <button
                    type="button"
                    onClick={chat.closeThread}
                    aria-label="Close the thread"
                    className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
                >
                    ✕
                </button>
            </header>

            <div ref={listRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto px-3">
                {parent && (
                    <ul className="border-b border-slate-200">
                        <MessageItem
                            message={parent}
                            currentUserId={currentUserId}
                            canReact={canReact}
                            names={names}
                            onToggleReaction={chat.toggleReaction}
                        />
                    </ul>
                )}

                {thread.hasMoreOlder && (
                    <div className="py-2 text-center">
                        <button
                            type="button"
                            disabled={loadingOlder}
                            onClick={showOlder}
                            className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            {loadingOlder ? "Loading…" : "Load earlier replies"}
                        </button>
                    </div>
                )}
                {!thread.loaded && <p className="py-4 text-center text-sm text-slate-500">Loading replies…</p>}
                {thread.loaded && thread.messages.length === 0 && (
                    <p className="py-4 text-center text-sm text-slate-500">No replies yet.</p>
                )}

                <ul aria-label="Replies" className="divide-y divide-slate-100">
                    {thread.messages.map((reply)=> (
                        <MessageItem
                            key={reply.id}
                            message={reply}
                            currentUserId={currentUserId}
                            canReact={canReact}
                            names={names}
                            onToggleReaction={chat.toggleReaction}
                        />
                    ))}
                </ul>
            </div>

            <div className="border-t border-slate-200 p-3">
                <MessageComposer
                    // a new composer for every thread, so a half-written reply does not move to another thread
                    key={thread.parentId}
                    label="Write a reply"
                    placeholder="Reply…"
                    members={members}
                    disabledReason={
                        chat.status !== "connected"
                            ? "You are offline, replies cannot be sent right now."
                            : !chat.canSend
                              ? "You can read this chat but not write in it."
                              : null
                    }
                    onSend={(content, mentions)=> chat.send(content, thread.parentId, mentions)}
                />
            </div>
        </aside>
    );
}

export default ThreadPanel;
