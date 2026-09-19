import { useState } from "react";

const maxLength = 4000; // the same limit as the server

// The box where a message is written. Enter sends, Shift+Enter starts a new line.
// The text is only cleared AFTER the server accepted the message : if sending fails, nothing the user wrote is lost.
// onSend(content) must throw when it fails, so the reason can be shown here.
const MessageComposer = ({ onSend, label, placeholder, disabledReason })=>{
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);

    const submit = async ()=>{
        const content = text.trim();
        if(!content || sending) return;

        setSending(true);
        setError(null);
        try{
            await onSend(content);
            setText("");
        }
        catch(err){
            setError(err.message);
        }
        setSending(false);
    }

    if(disabledReason){
        return <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">{disabledReason}</p>;
    }

    return (
        <form
            onSubmit={(event)=>{
                event.preventDefault();
                submit();
            }}
        >
            {error && (
                <p role="alert" className="mb-2 text-sm text-red-600">
                    {error}
                </p>
            )}
            <div className="flex items-end gap-2">
                <textarea
                    aria-label={label}
                    placeholder={placeholder}
                    value={text}
                    maxLength={maxLength}
                    rows={2}
                    // readOnly, not disabled : a disabled box would lose the keyboard focus while the message is being sent
                    readOnly={sending}
                    onChange={(event)=> setText(event.target.value)}
                    onKeyDown={(event)=>{
                        // isComposing : Enter that only confirms a word typed with an input method must not send
                        if(event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing){
                            event.preventDefault();
                            submit();
                        }
                    }}
                    className="min-h-[3rem] flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
                />
                <button
                    type="submit"
                    disabled={sending || text.trim() === ""}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                    {sending ? "Sending…" : "Send"}
                </button>
            </div>
            {text.length > maxLength - 500 && (
                <p className="mt-1 text-right text-xs text-slate-500">
                    {text.length} / {maxLength}
                </p>
            )}
        </form>
    );
}

export default MessageComposer;
