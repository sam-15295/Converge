import MentionText from "../mentions/MentionText";
import { formatTime, timeAgo } from "../../utils/formatTime";

// One comment or reply. The text is shown as plain text with its mentions highlighted (never as HTML).
// domId : the id in the page, so a link can scroll to it. highlighted : it flashes (what a link pointed at).
// onDelete is left out when the user may not delete it.
const CommentItem = ({ comment, currentUserId, onDelete, domId, highlighted, isReply = false })=>{
    const isMine = comment.author.id === currentUserId;

    return (
        <div id={domId} className={`px-3 py-2 ${isReply ? "border-l-2 border-slate-200 pl-3" : ""} ${highlighted ? "flash-highlight" : ""}`}>
            <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-slate-900">
                    {comment.author.name ?? "Someone"}
                    {isMine && <span className="font-normal text-slate-500"> (you)</span>}
                </span>
                <time dateTime={comment.createdAt} title={formatTime(comment.createdAt)} className="text-xs text-slate-500">
                    {timeAgo(comment.createdAt)}
                </time>
                {onDelete && (
                    <button
                        type="button"
                        onClick={onDelete}
                        aria-label={isReply ? "Delete this reply" : "Delete this comment"}
                        className="ml-auto text-xs text-slate-500 hover:text-red-700 hover:underline"
                    >
                        Delete
                    </button>
                )}
            </p>
            <MentionText content={comment.content} mentions={comment.mentions} currentUserId={currentUserId} />
        </div>
    );
}

export default CommentItem;
