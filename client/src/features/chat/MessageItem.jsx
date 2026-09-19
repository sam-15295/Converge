import ReactionBar from "./ReactionBar";
import { splitByMentions } from "./mentions";
import { formatTime } from "../../utils/formatTime";

// The text of a message with its mentions highlighted (yours in yellow, the others in blue).
// It is built from separate pieces of TEXT, never from HTML : React escapes every piece, so nothing a person writes
// can ever run. Only mentions stored with the message are highlighted, a "@Priya" typed by hand stays plain.
const MessageText = ({ content, mentions, currentUserId })=>{
    return (
        <p className="wrap-break-word whitespace-pre-wrap text-slate-800">
            {splitByMentions(content, mentions).map((part, index)=>
                part.userIds ? (
                    <span
                        key={index}
                        className={`rounded px-0.5 font-medium ${
                            part.userIds.includes(currentUserId) ? "bg-amber-200 text-amber-900" : "bg-blue-100 text-blue-800"
                        }`}
                    >
                        {part.text}
                    </span>
                ) : (
                    part.text
                )
            )}
        </p>
    );
}

// One message.
// onOpenThread is left out for a message that is already inside a thread (replies have no replies).
const MessageItem = ({ message, currentUserId, canReact, canReply, names, onToggleReaction, onOpenThread })=>{
    const isMine = message.sender.id === currentUserId;
    const replies = message.replyCount;
    const mentionsMe = message.mentions.some((mention)=> mention.userId === currentUserId);

    // somebody who may only read has nothing to do with a "Reply" button, but can still open an existing thread
    const showThreadButton = onOpenThread && (replies > 0 || canReply);

    return (
        <li className={`flex gap-3 px-1 py-2 ${mentionsMe ? "rounded-md bg-amber-50" : ""}`}>
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
                    {mentionsMe && <span className="sr-only">mentions you</span>}
                </p>

                <MessageText content={message.content} mentions={message.mentions} currentUserId={currentUserId} />

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
