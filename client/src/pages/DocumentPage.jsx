import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import FullPageMessage from "../components/FullPageMessage";
import { useAuth } from "../features/auth/AuthContext";
import DocumentEditor from "../features/documents/DocumentEditor";
import DocumentTitle from "../features/documents/DocumentTitle";
import { deleteDocument, getDocument } from "../features/documents/documentApi";
import { useFetch } from "../hooks/useFetch";

const DocumentPage = ()=>{
    const { workspaceId, documentId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const details = useFetch((signal)=> getDocument(workspaceId, documentId, signal), [workspaceId, documentId]);
    const [deleteError, setDeleteError] = useState(null);

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
        <main className="mx-auto min-h-[calc(100dvh-3rem)] max-w-3xl px-4 py-10">
            <Link to={`/workspace/${workspaceId}`} className="text-sm text-slate-600 underline">
                ← Back to the workspace
            </Link>

            <div className="mt-3 mb-4">
                <DocumentTitle
                    key={document.id}
                    workspaceId={workspaceId}
                    documentId={documentId}
                    initialTitle={document.title}
                    canEdit={canEdit}
                />
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
        </main>
    );
}

export default DocumentPage;
