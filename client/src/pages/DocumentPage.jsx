import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import FullPageMessage from "../components/FullPageMessage";
import { useAuth } from "../features/auth/AuthContext";
import CommentsButton from "../features/comments/CommentsButton";
import DocumentColumns from "../features/comments/DocumentColumns";
import DocumentCommentsProvider from "../features/comments/DocumentCommentsProvider";
import DocumentEditor from "../features/documents/DocumentEditor";
import DocumentTitle from "../features/documents/DocumentTitle";
import { deleteDocument, getDocument } from "../features/documents/documentApi";
import HistoryButton from "../features/versions/HistoryButton";
import VersionHistoryDialog from "../features/versions/VersionHistoryDialog";
import { getMembers } from "../features/workspace/workspaceApi";
import { useFetch } from "../hooks/useFetch";

const isId = (value)=> /^[a-f0-9]{24}$/i.test(value ?? "");

const DocumentPage = ()=>{
    const { workspaceId, documentId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [params] = useSearchParams();
    const location = useLocation();

    // A link from a notification : /document/<id>?comment=<id>  (and &reply=<id> when the mention is inside a thread).
    // The location key changes with every visit, so following the same link again works again.
    const commentId = isId(params.get("comment")) ? params.get("comment").toLowerCase() : null;
    const replyId = commentId && isId(params.get("reply")) ? params.get("reply").toLowerCase() : null;
    const focus = useMemo(
        ()=> (commentId ? { commentId, replyId, key: location.key } : null),
        [commentId, replyId, location.key]
    );

    const details = useFetch((signal)=> getDocument(workspaceId, documentId, signal), [workspaceId, documentId]);
    // The people who can be mentioned in a comment. The page does not wait for them : without them the comment box still
    // works, only the suggestions after "@" are missing until they arrive.
    const people = useFetch((signal)=> getMembers(workspaceId, signal), [workspaceId]);
    const [deleteError, setDeleteError] = useState(null);
    const [historyOpen, setHistoryOpen] = useState(false);

    if(details.loading && !details.data) return <FullPageMessage>Loading…</FullPageMessage>;

    if(details.error){
        const notFound = details.error.status === 404;
        return (
            <FullPageMessage>
                <span className="text-center">
                    {notFound ? "This document does not exist, or you cannot open it." : details.error.message}
                    <br />
                    <Link
                        to={`/workspace/${workspaceId}`}
                        className="mt-3 inline-block font-medium text-slate-900 underline"
                    >
                        Back to the workspace
                    </Link>
                </span>
            </FullPageMessage>
        );
    }

    const { document, permissions, canDelete } = details.data;
    const canEdit = permissions.includes("document:edit");

    const handleDelete = async ()=>{
        if(!window.confirm(`Delete "${document.title}"? This cannot be undone.`)) return;
        setDeleteError(null);
        try{
            await deleteDocument(workspaceId, documentId);
            navigate(`/workspace/${workspaceId}`);
        }
        catch(err){
            setDeleteError(err.message);
        }
    }

    return (
        <DocumentCommentsProvider
            workspaceId={workspaceId}
            documentId={documentId}
            permissions={permissions}
            currentUserId={user.id}
            members={people.data?.members ?? []}
            focus={focus}
        >
            <main className="mx-auto min-h-[calc(100dvh-3rem)] max-w-6xl px-4 py-10">
                <DocumentColumns>
                    <Link to={`/workspace/${workspaceId}`} className="text-sm text-slate-600 underline">
                        ← Back to the workspace
                    </Link>

                    <div className="mt-3 mb-4 flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <DocumentTitle
                                key={document.id}
                                workspaceId={workspaceId}
                                documentId={documentId}
                                initialTitle={document.title}
                                canEdit={canEdit}
                            />
                        </div>
                        <HistoryButton open={historyOpen} onClick={()=> setHistoryOpen(true)} />
                        <CommentsButton />
                    </div>

                    {/* The text does not come from the request above : the editor gets it over the socket, and stays in sync with everybody. */}
                    <DocumentEditor
                        workspaceId={workspaceId}
                        documentId={documentId}
                        canEditPermission={canEdit}
                        userName={user.name}
                    />

                    {canDelete && (
                        <div className="mt-8 border-t border-slate-200 pt-4">
                            {deleteError && (
                                <p role="alert" className="mb-2 text-sm text-red-600">
                                    {deleteError}
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                            >
                                Delete document
                            </button>
                        </div>
                    )}
                </DocumentColumns>

                {/* Restoring a version does not have to tell the editor anything : the server sends the change to
                    everybody who has the document open, and this tab is one of them. */}
                <VersionHistoryDialog
                    workspaceId={workspaceId}
                    documentId={documentId}
                    canRestore={permissions.includes("version:restore")}
                    open={historyOpen}
                    onClose={()=> setHistoryOpen(false)}
                />
            </main>
        </DocumentCommentsProvider>
    );
}

export default DocumentPage;
