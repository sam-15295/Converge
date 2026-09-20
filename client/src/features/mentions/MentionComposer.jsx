import { useId, useLayoutEffect, useRef, useState } from "react";
import { findMentionQuery, insertMention, mentionsInText, suggestMembers } from "./mentions";

const messageMaxLength = 4000; // the limit of a chat message on the server

// The box where a message or a comment is written. Enter sends, Shift+Enter starts a new line.
// The text is only cleared AFTER the server accepted the message : if sending fails, nothing the user wrote is lost.
// onSend(content, mentions) must throw when it fails, so the reason can be shown here.
//
// members : the people who can be mentioned, [{ userId, name }]. Typing "@" opens a list of them :
//   arrow keys move, Enter or Tab (or a click) choose, Escape closes. Only people CHOSEN from the list are mentions,
//   a "@Priya" typed by hand stays plain text. If the name is edited away after choosing, the mention is dropped.
// maxLength : the longest text the server accepts here (a comment is shorter than a chat message)
const MentionComposer = ({ onSend, label, placeholder, disabledReason, members = [], maxLength = messageMaxLength })=>{
    const [text, setText] = useState("");
    const [caret, setCaret] = useState(0);
    const [picked, setPicked] = useState([]);
    const [highlight, setHighlight] = useState(0);
    const [dismissedAt, setDismissedAt] = useState(null); // Escape closed the list for the "@" at this position
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const boxRef = useRef(null);
    const listId = useId();

    // Where the caret must go once the text with the chosen name is on the screen. React puts the caret at the END when it
    // sets a new value, so it is moved right behind the inserted name in a layout effect : that runs in the same commit as the
    // new text, before the browser handles the next key. (A later frame, like requestAnimationFrame, could run between two
    // keys of somebody who types straight on, and would jump the caret back before the letters already typed.)
    const caretAfterRender = useRef(null);
    useLayoutEffect(()=>{
        if(caretAfterRender.current === null) return;
        boxRef.current?.setSelectionRange(caretAfterRender.current, caretAfterRender.current);
        caretAfterRender.current = null;
    });

    // The list is worked out from the text and the caret, it is not state of its own, so it can never be out of date
    const typing = findMentionQuery(text, caret);
    const suggestions = typing && typing.start !== dismissedAt ? suggestMembers(members, typing.query) : [];
    const listOpen = suggestions.length > 0;
    const active = Math.min(highlight, suggestions.length - 1);

    const submit = async ()=>{
        const content = text.trim();
        if(!content || sending) return;

        setSending(true);
        setError(null);
        try{
            await onSend(content, mentionsInText(content, picked));
            setText("");
            setCaret(0);
            setPicked([]);
            setDismissedAt(null);
        }
        catch(err){
            setError(err.message);
        }
        setSending(false);
    }

    const changed = (event)=>{
        setText(event.target.value);
        setCaret(event.target.selectionStart);
        setHighlight(0);
    }

    const choose = (member)=>{
        const result = insertMention(text, typing.start, caret, member);

        setText(result.text);
        setCaret(result.caret);
        setPicked((list)=> (list.some((item)=> item.userId === member.userId) ? list : [...list, member]));
        caretAfterRender.current = result.caret;
    }

    const keyPressed = (event)=>{
        // Keys that only confirm or move inside an input method (Chinese, Japanese ...) must not act
        if(event.nativeEvent.isComposing) return;

        if(listOpen){
            if(event.key === "ArrowDown" || event.key === "ArrowUp"){
                event.preventDefault();
                const step = event.key === "ArrowDown" ? 1 : -1;
                setHighlight((active + step + suggestions.length) % suggestions.length);
                return;
            }
            if((event.key === "Enter" && !event.shiftKey) || event.key === "Tab"){
                event.preventDefault();
                choose(suggestions[active]);
                return;
            }
            if(event.key === "Escape"){
                event.preventDefault();
                setDismissedAt(typing.start);
                return;
            }
        }

        if(event.key === "Enter" && !event.shiftKey){
            event.preventDefault();
            submit();
        }
    }

    if(disabledReason){
        return <p className="rounded-md bg-raised px-3 py-2 text-sm text-body">{disabledReason}</p>;
    }

    return (
        <form
            onSubmit={(event)=>{
                event.preventDefault();
                submit();
            }}
        >
            {error && (
                <p role="alert" className="mb-2 text-sm text-danger">
                    {error}
                </p>
            )}
            <div className="flex items-end gap-2">
                <div className="relative flex-1">
                    {/* opens UPWARDS, like the reaction list : the message list above scrolls, the page below does not */}
                    {listOpen && (
                        <ul
                            id={listId}
                            role="listbox"
                            aria-label="People you can mention"
                            className="absolute bottom-full left-0 z-10 mb-1 max-h-48 w-64 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-md"
                        >
                            {suggestions.map((member, index)=> (
                                <li
                                    key={member.userId}
                                    id={`${listId}-${index}`}
                                    role="option"
                                    aria-selected={index === active}
                                    // mouse down (not click) and preventDefault : the box must keep the keyboard focus
                                    onMouseDown={(event)=>{
                                        event.preventDefault();
                                        choose(member);
                                    }}
                                    className={`cursor-pointer truncate px-3 py-1.5 text-sm ${
                                        index === active ? "bg-info-bg text-info" : "text-body hover:bg-raised"
                                    }`}
                                >
                                    {member.name}
                                </li>
                            ))}
                        </ul>
                    )}
                    <textarea
                        ref={boxRef}
                        aria-label={label}
                        aria-autocomplete={members.length > 0 ? "list" : undefined}
                        aria-controls={listOpen ? listId : undefined}
                        aria-activedescendant={listOpen ? `${listId}-${active}` : undefined}
                        placeholder={placeholder}
                        value={text}
                        maxLength={maxLength}
                        rows={2}
                        // readOnly, not disabled : a disabled box would lose the keyboard focus while the message is being sent
                        readOnly={sending}
                        onChange={changed}
                        onSelect={(event)=> setCaret(event.target.selectionStart)}
                        onKeyDown={keyPressed}
                        className="min-h-[3rem] w-full resize-none rounded-md border border-line-strong px-3 py-2 text-strong focus:border-primary focus:outline-none"
                    />
                </div>
                <button
                    type="submit"
                    disabled={sending || text.trim() === ""}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                    {sending ? "Sending…" : "Send"}
                </button>
            </div>
            <p role="status" className="sr-only">
                {listOpen ? `${suggestions.length} people match. Use the up and down arrow keys and Enter to choose.` : ""}
            </p>
            {text.length > maxLength - 500 && (
                <p className="mt-1 text-right text-xs text-muted">
                    {text.length} / {maxLength}
                </p>
            )}
        </form>
    );
}

export default MentionComposer;
