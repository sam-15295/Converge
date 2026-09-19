import { useMemo } from "react";
import { Link } from "react-router-dom";
import MessageComposer from "./MessageComposer";
import MessageList from "./MessageList";
import OnlinePeople from "./OnlinePeople";
import ThreadPanel from "./ThreadPanel";
import { useWorkspaceChat } from "./useWorkspaceChat";

// One workspace's chat : who is online, the messages, the box to write in, and the open thread.
// The page gives this a `key` of the workspace id, so opening another workspace starts from a clean state.
// focus : { messageId, replyId, key } when the chat was opened from a link (see useWorkspaceChat).
const ChatRoom = ({ workspaceId, currentUserId, members, focus })=>{
    const chat = useWorkspaceChat(workspaceId, currentUserId, focus);

    const names = useMemo(()=> Object.fromEntries(members.map((member)=> [member.userId, member.name])), [members]);
    const openParent = chat.thread ? chat.messages.find((message)=> message.id === chat.thread.parentId) : null;

    // Who may react is the same group who may send (the server checks both separately, this only decides what to show)
    const canReact = chat.canSend && chat.status === "connected";

    if(chat.status === "denied"){
        return (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-red-700">
                <p>{chat.notice}</p>
                <Link to={`/workspace/${workspaceId}`} className="mt-3 inline-block font-medium underline">
                    Back to the workspace
                </Link>
            </div>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <OnlinePeople members={members} onlineUserIds={chat.onlineUserIds} currentUserId={currentUserId} />

            {chat.status !== "connected" && (
                <p
                    role="status"
                    className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                    {chat.status === "connecting"
                        ? "Connecting…"
                        : "You are offline. Trying to reconnect : what you missed will appear when you are back."}
                </p>
            )}

            {chat.detached && (
                <p
                    role="status"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"
                >
                    <span>
                        You are looking at older messages
                        {chat.missed > 0 ? ` : ${chat.missed} new ${chat.missed === 1 ? "message has" : "messages have"} arrived since` : ""}.
                    </span>
                    <button type="button" onClick={chat.jumpToLatest} className="font-medium underline">
                        Jump to latest
                    </button>
                </p>
            )}

            {chat.problem && (
                <p
                    role="alert"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                    <span>{chat.problem}</span>
                    <span className="flex gap-3">
                        {!chat.loaded && (
                            <button type="button" onClick={chat.reload} className="font-medium underline">
                                Try again
                            </button>
                        )}
                        <button type="button" onClick={chat.dismissProblem} className="font-medium underline">
                            Dismiss
                        </button>
                    </span>
                </p>
            )}

            <div className="flex min-h-0 flex-1 gap-4">
                {/* on a small screen an open thread takes the whole width, the main chat is hidden meanwhile */}
                <section className={`min-w-0 flex-1 flex-col gap-3 ${chat.thread ? "hidden md:flex" : "flex"}`}>
                    <MessageList chat={chat} currentUserId={currentUserId} canReact={canReact} names={names} />
                    <MessageComposer
                        label="Write a message"
                        placeholder="Write a message…  (@ mentions somebody, Enter sends, Shift+Enter is a new line)"
                        members={members}
                        disabledReason={
                            chat.status !== "connected"
                                ? "You are offline, messages cannot be sent right now."
                                : !chat.canSend
                                  ? "You can read this chat but not write in it."
                                  : null
                        }
                        onSend={(content, mentions)=> chat.send(content, undefined, mentions)}
                    />
                </section>

                {chat.thread && (
                    <div className="flex min-h-0 w-full flex-col md:w-96 md:shrink-0">
                        <ThreadPanel
                            chat={chat}
                            parent={openParent}
                            currentUserId={currentUserId}
                            canReact={canReact}
                            names={names}
                            members={members}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChatRoom;
