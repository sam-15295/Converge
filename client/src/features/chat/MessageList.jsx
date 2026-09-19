import { useState } from "react";
import MessageItem from "./MessageItem";
import { useMessageScroll } from "./useMessageScroll";

// The scrolling list of the main chat, oldest at the top. Scrolling up to the top offers the older history.
const MessageList = ({ chat, currentUserId, canReact, names })=>{
    const { listRef, handleScroll } = useMessageScroll(chat.messages, currentUserId);
    const [loadingOlder, setLoadingOlder] = useState(false);

    const showOlder = async ()=>{
        setLoadingOlder(true);
        await chat.loadOlder();
        setLoadingOlder(false);
    }

    return (
        <div
            ref={listRef}
            onScroll={handleScroll}
            role="log"
            aria-label="Chat messages"
            aria-live="polite"
            className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
        >
            {chat.hasMoreOlder && (
                <div className="py-2 text-center">
                    <button
                        type="button"
                        disabled={loadingOlder}
                        onClick={showOlder}
                        className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        {loadingOlder ? "Loading…" : "Load older messages"}
                    </button>
                </div>
            )}

            {!chat.loaded && !chat.problem && <p className="py-6 text-center text-sm text-slate-500">Loading messages…</p>}
            {chat.loaded && chat.messages.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">
                    No messages yet.{chat.canSend ? " Say hello!" : ""}
                </p>
            )}

            <ul className="divide-y divide-slate-100">
                {chat.messages.map((message)=> (
                    <MessageItem
                        key={message.id}
                        message={message}
                        currentUserId={currentUserId}
                        canReact={canReact}
                        canReply={chat.canSend}
                        names={names}
                        onToggleReaction={chat.toggleReaction}
                        onOpenThread={chat.openThread}
                    />
                ))}
            </ul>
        </div>
    );
}

export default MessageList;
