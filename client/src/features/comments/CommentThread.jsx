import { useState } from "react";
import MentionComposer from "../mentions/MentionComposer";
import { timeAgo } from "../../utils/formatTime";
import CommentItem from "./CommentItem";
import { useCommentsContext } from "./CommentsContext";
import { commentMaxLength } from "./commentsState";

// A thread : its first comment, the replies, and what can be done with it (reply, resolve or reopen, delete).
// The buttons are only a convenience, the server checks every request again.
// highlight : { id, token } : the comment inside this thread that a link pointed at (it flashes)
const CommentThread = ({ thread, highlight })=>{
    const { currentUserId, permissions, canComment, connection, members, write, resolve, reopen, remove } = useCommentsContext();
    const [replying, setReplying] = useState(false);

    // OWNER and ADMIN may delete any comment, everybody who may write their own
    const canDelete = (comment)=>
        permissions.includes("comment:delete") || (canComment && comment.author.id === currentUserId);

    const handleDelete = (comment)=>{
        const replies = comment.parentCommentId ? 0 : thread.replies.length;
        const question = replies > 0
            ? `Delete this comment and its ${replies} ${replies === 1 ? "reply" : "replies"}?`
            : "Delete this comment?";

        if(window.confirm(question)) remove(comment);
    }

    const item = (comment, isReply)=>{
        const focused = highlight?.id === comment.id;

        return (
            <CommentItem
                // the token makes the highlighted comment a NEW element each time, so its flash plays again
                key={focused ? `${comment.id}:${highlight.token}` : comment.id}
                comment={comment}
                isReply={isReply}
                domId={`comment-${comment.id}`}
                highlighted={focused}
                currentUserId={currentUserId}
                onDelete={canDelete(comment) ? ()=> handleDelete(comment) : undefined}
            />
        );
    }

    return (
        <li className={`rounded-lg border bg-surface ${thread.resolved ? "border-line bg-raised" : "border-line-strong"}`}>
            {item(thread, false)}
            {thread.replies.map((reply)=> item(reply, true))}

            <div className="border-t border-line px-3 py-2">
                {thread.resolved ? (
                    <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-body">
                        <span>
                            Resolved{thread.resolvedBy?.name ? ` by ${thread.resolvedBy.name}` : ""}{" "}
                            {thread.resolvedAt && <time dateTime={thread.resolvedAt}>{timeAgo(thread.resolvedAt)}</time>}
                        </span>
                        {canComment && (
                            <button type="button" onClick={()=> reopen(thread.id)} className="font-medium text-info hover:underline">
                                Reopen
                            </button>
                        )}
                    </p>
                ) : canComment ? (
                    <div>
                        {replying ? (
                            <MentionComposer
                                label="Write a reply"
                                placeholder="Reply…  (@ mentions somebody)"
                                members={members}
                                maxLength={commentMaxLength}
                                disabledReason={connection === "denied" ? "These comments are closed." : null}
                                onSend={async (content, mentions)=>{
                                    await write(content, thread.id, mentions);
                                    setReplying(false);
                                }}
                            />
                        ) : (
                            <div className="flex items-center justify-between gap-2">
                                <button type="button" onClick={()=> setReplying(true)} className="text-sm font-medium text-info hover:underline">
                                    Reply
                                </button>
                                <button type="button" onClick={()=> resolve(thread.id)} className="text-sm text-body hover:underline">
                                    Resolve
                                </button>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

export default CommentThread;
