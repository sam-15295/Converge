import { useCommentsContext } from "./CommentsContext";

// The button in the header of the document that shows or hides the comments, with the number of threads that are still open
// (worked out by the server and kept right live).
const CommentsButton = ()=>{
    const { open, toggle, openCount } = useCommentsContext();

    return (
        <button
            type="button"
            aria-expanded={open}
            onClick={toggle}
            className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${
                open ? "border-primary bg-primary text-white" : "border-line-strong text-body hover:bg-raised"
            }`}
        >
            Comments
            {openCount > 0 && (
                <span
                    aria-hidden="true"
                    className={`min-w-5 rounded-full px-1.5 text-center text-xs leading-5 ${open ? "bg-surface text-strong" : "bg-info-solid text-white"}`}
                >
                    {openCount}
                </span>
            )}
            <span className="sr-only">{openCount === 1 ? "1 open thread" : `${openCount} open threads`}</span>
        </button>
    );
}

export default CommentsButton;
