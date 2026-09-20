import { useState } from "react";
import { reactionOptions } from "./chatApi";

// The reactions under one message : a button for each emoji somebody used (with how many), and a small button that
// opens the list of all emoji. Clicking an emoji you already used takes your reaction back.
// names : { userId : "Name" }, to tell who reacted (shown on hover and read out by screen readers)
const ReactionBar = ({ message, currentUserId, canReact, names, onToggle })=>{
    const [picking, setPicking] = useState(false);

    const choose = (emoji)=>{
        setPicking(false);
        onToggle(message, emoji);
    }

    return (
        <div className="mt-1 flex flex-wrap items-center gap-1">
            {message.reactions.map(({ emoji, userIds })=>{
                const mine = userIds.includes(currentUserId);
                const who = userIds.map((id)=> (id === currentUserId ? "You" : (names[id] ?? "Someone"))).join(", ");
                return (
                    <button
                        key={emoji}
                        type="button"
                        disabled={!canReact}
                        aria-pressed={mine}
                        aria-label={`${emoji} ${userIds.length} : ${who}`}
                        title={who}
                        onClick={()=> onToggle(message, emoji)}
                        className={`rounded-full border px-2 py-0.5 text-sm disabled:cursor-default ${
                            mine
                                ? "border-info-line bg-info-bg text-info"
                                : "border-line bg-surface text-body enabled:hover:bg-raised"
                        }`}
                    >
                        <span aria-hidden="true">{emoji}</span> {userIds.length}
                    </button>
                );
            })}

            {canReact && (
                <div
                    className="relative"
                    onKeyDown={(event)=>{
                        if(event.key === "Escape") setPicking(false);
                    }}
                >
                    <button
                        type="button"
                        aria-label="Add a reaction"
                        aria-expanded={picking}
                        onClick={()=> setPicking((open)=> !open)}
                        className="rounded-full border border-dashed border-line-strong px-2 py-0.5 text-sm text-muted hover:bg-raised"
                    >
                        +
                    </button>
                    {/* opens UPWARDS : the list of messages scrolls and would cut off something that opens downwards */}
                    {picking && (
                        <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-lg border border-line bg-surface p-1 shadow-md">
                            {reactionOptions.map((emoji)=> (
                                <button
                                    key={emoji}
                                    type="button"
                                    aria-label={`React with ${emoji}`}
                                    onClick={()=> choose(emoji)}
                                    className="rounded-md px-1.5 py-1 text-lg hover:bg-raised"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ReactionBar;
