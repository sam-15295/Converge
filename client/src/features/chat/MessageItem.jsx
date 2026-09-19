import ReactionBar from "./ReactionBar";
import MentionText from "../mentions/MentionText";
import { formatTime } from "../../utils/formatTime";

// One message.
// onOpenThread is left out for a message that is already inside a thread (replies have no replies).
// domId : the id in the page, so a link can scroll to the message. highlighted : it flashes (the message a link pointed at).
const MessageItem = ({ message, currentUserId, canReact, canReply, names, onToggleReaction, onOpenThread, domId, highlighted })=>{
    const isMine = message.sender.id === currentUserId;
    const replies = message.replyCount;
    const mentionsMe = message.mentions.some((mention)=> mention.userId === currentUserId);

    // somebody who may only read has nothing to do with a "Reply" button, but can still open an existing thread
    const showThreadButton = onOpenThread && (replies > 0 || canReply);

    return (
        <li id={domId} className={`flex gap-3 px-1 py-2 ${mentionsMe ? "rounded-md bg-amber-50" : ""} ${highlighted ? "flash-highlight" : ""}`}>
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

                <MentionText content={message.content} mentions={message.mentions} currentUserId={currentUserId} />

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
