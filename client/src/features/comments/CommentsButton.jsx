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
                open ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
        >
            Comments
            {openCount > 0 && (
                <span
                    aria-hidden="true"
                    className={`min-w-5 rounded-full px-1.5 text-center text-xs leading-5 ${open ? "bg-white text-slate-900" : "bg-blue-600 text-white"}`}
                >
                    {openCount}
                </span>
            )}
            <span className="sr-only">{openCount === 1 ? "1 open thread" : `${openCount} open threads`}</span>
        </button>
    );
}

export default CommentsButton;
