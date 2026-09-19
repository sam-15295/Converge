import CommentsPanel from "./CommentsPanel";
import { useCommentsContext } from "./CommentsContext";

// The layout of the document page : the editor (and what belongs to it) in the middle, and when the comments are open, the
// panel next to it. On a narrow screen the panel goes below the editor instead of next to it.
const DocumentColumns = ({ children })=>{
    const { open } = useCommentsContext();

    return (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* closed : the editor stays centred, like a page without comments */}
            <div className={`min-w-0 flex-1 ${open ? "" : "mx-auto max-w-3xl"}`}>{children}</div>
            {open && (
                <div className="w-full lg:sticky lg:top-6 lg:w-96 lg:shrink-0">
                    <CommentsPanel />
                </div>
            )}
        </div>
    );
}

export default DocumentColumns;
