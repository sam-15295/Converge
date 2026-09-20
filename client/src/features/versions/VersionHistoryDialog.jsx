import { useEffect, useId, useRef, useState } from "react";
import { formatTime } from "../../utils/formatTime";
import VersionList from "./VersionList";
import VersionPreview from "./VersionPreview";
import { useVersionHistory } from "./useVersionHistory";

// The history of a document : the versions on the left, what the document looked like then on the right, and a way to
// put one back. It is a dialog and not a third column, because looking through history is something you do instead of
// editing, not next to it.
const VersionHistoryDialog = ({ workspaceId, documentId, canRestore, open, onClose })=>{
    const history = useVersionHistory(workspaceId, documentId, open);
    const [loadingMore, setLoadingMore] = useState(false);
    const [restored, setRestored] = useState(null);
    const dialogRef = useRef(null);
    const titleId = useId();

    const selected = history.versions.find((version)=> version.id === history.selectedId) ?? null;

    // Escape closes it, and the dialog takes the keyboard focus when it opens
    useEffect(()=>{
        if(!open) return;

        dialogRef.current?.focus();
        const onKeyDown = (event)=> event.key === "Escape" && onClose();
        document.addEventListener("keydown", onKeyDown);

        return ()=> document.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    if(!open) return null;

    const showMore = async ()=>{
        setLoadingMore(true);
        await history.loadMore();
        setLoadingMore(false);
    }

    const putBack = async ()=>{
        if(!selected) return;
        if(!window.confirm("Put this version back? The current text becomes a version too, so this can be undone.")) return;

        setRestored(null);
        if(await history.restore(selected.id)) setRestored("This version was put back. Everybody editing the document now sees it.");
    }

    return (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className="flex h-[min(44rem,calc(100dvh-2rem))] w-full max-w-5xl flex-col rounded-lg bg-surface shadow-xl outline-none"
            >
                <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                    <h2 id={titleId} className="font-semibold text-strong">
                        Version history
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close the version history"
                        className="rounded-md px-2 py-1 text-sm text-body hover:bg-raised"
                    >
                        Close
                    </button>
                </header>

                {history.problem && (
                    <p role="alert" className="border-b border-danger-line bg-danger-bg px-4 py-2 text-sm text-danger">
                        {history.problem}
                    </p>
                )}
                {restored && (
                    <p role="status" className="border-b border-success-line bg-success-bg px-4 py-2 text-sm text-success">
                        {restored}
                    </p>
                )}

                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                    <div className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-line sm:w-64 sm:border-r sm:border-b-0">
                        {history.loading && <p className="p-4 text-sm text-muted">Loading the history…</p>}
                        {!history.loading && history.versions.length === 0 && (
                            <p className="p-4 text-sm text-muted">
                                No versions yet. One is kept each time somebody edits this document and then stops for a while.
                            </p>
                        )}
                        {history.versions.length > 0 && (
                            <VersionList
                                versions={history.versions}
                                selectedId={history.selectedId}
                                onSelect={history.select}
                                hasMore={history.hasMore}
                                onLoadMore={showMore}
                                loadingMore={loadingMore}
                            />
                        )}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto bg-raised p-4">
                        {selected && (
                            <p className="mb-3 text-sm text-body">
                                <span className="font-medium text-strong">{selected.title}</span> as it was on{" "}
                                <time dateTime={selected.createdAt}>{formatTime(selected.createdAt)}</time>
                            </p>
                        )}
                        {history.previewLoading && <p className="text-sm text-muted">Loading that version…</p>}
                        {history.preview && <VersionPreview key={history.preview.id} content={history.preview.content} />}
                    </div>
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
                    <p className="text-sm text-muted">
                        {canRestore
                            ? "Putting a version back is an ordinary edit : it can be undone."
                            : "You can look through the history but not change the document."}
                    </p>
                    {canRestore && (
                        <button
                            type="button"
                            disabled={!selected || history.restoring}
                            onClick={putBack}
                            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                        >
                            {history.restoring ? "Putting it back…" : "Restore this version"}
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
}

export default VersionHistoryDialog;
