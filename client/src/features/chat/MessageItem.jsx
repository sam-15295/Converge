import ReactionBar from "./ReactionBar";
import { formatTime } from "../../utils/formatTime";

// One message. The text is shown as plain text : React escapes it, so nothing a person writes can ever run as HTML.
// onOpenThread is left out for a message that is already inside a thread (replies have no replies).
const MessageItem = ({ message, currentUserId, canReact, canReply, names, onToggleReaction, onOpenThread })=>{
    const isMine = message.sender.id === currentUserId;
    const replies = message.replyCount;

    // somebody who may only read has nothing to do with a "Reply" button, but can still open an existing thread
    const showThreadButton = onOpenThread && (replies > 0 || canReply);

    return (
        <li className="flex gap-3 px-1 py-2">
            <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700"
            >
                {message.sender.name.slice(0, 1).toUpperCase()}
            </span>

            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-slate-900">
                        {message.sender.name}
                        {isMine && <span className="font-normal text-slate-500"> (you)</span>}
                    </span>
                    <time dateTime={message.createdAt} className="text-xs text-slate-500">
                        {formatTime(message.createdAt)}
                    </time>
                </p>

                <p className="break-words whitespace-pre-wrap text-slate-800">{message.content}</p>

                <ReactionBar
                    message={message}
                    currentUserId={currentUserId}
                    canReact={canReact}
                    names={names}
                    onToggle={onToggleReaction}
                />

                {showThreadButton && (
                    <button
                        type="button"
                        onClick={()=> onOpenThread(message.id)}
                        className="mt-1 text-sm font-medium text-blue-700 hover:underline"
                    >
                        {replies === 0 ? "Reply" : `${replies} ${replies === 1 ? "reply" : "replies"}`}
                    </button>
                )}
            </div>
        </li>
    );
}

export default MessageItem;
