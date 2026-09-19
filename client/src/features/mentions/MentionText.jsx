import { splitByMentions } from "./mentions";

// The text of a message or comment with its mentions highlighted (yours in yellow, the others in blue).
// It is built from separate pieces of TEXT, never from HTML : React escapes every piece, so nothing a person writes
// can ever run. Only mentions stored with the text are highlighted, a "@Priya" typed by hand stays plain.
const MentionText = ({ content, mentions, currentUserId })=>{
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

export default MentionText;
