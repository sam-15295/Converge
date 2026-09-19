import { useEffect, useState } from "react";
import * as Y from "yjs";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Collaborators from "./Collaborators";
import EditorToolbar from "./EditorToolbar";
import { SocketIOProvider } from "./collab/SocketIOProvider";

const initialConnection = {
    status: "connecting",
    synced: false,
    everSynced: false,
    canEdit: false,
    message: null,
    unsyncedChanges: false
};

// The rich-text editor (TipTap) connected to the shared Yjs document.
// There is no "save" here any more : every keystroke becomes a small Yjs update that goes to the server and to
// everybody else who has the document open, and the server stores the document by itself.
const DocumentEditor = ({ workspaceId, documentId, canEditPermission, userName })=>{
    const [session, setSession] = useState(null);
    const [connection, setConnection] = useState(initialConnection);

    // One Yjs document and one connection per opened document. Created here (not while rendering), because they are
    // external resources : a network connection and timers.
    useEffect(()=>{
        const doc = new Y.Doc();
        const provider = new SocketIOProvider({ workspaceId, documentId, doc, onChange: setConnection });
        provider.connect();
        // oxlint-disable-next-line react/set-state-in-effect -- the session is an external resource created by this effect
        setSession({ doc, provider });

        return ()=>{
            provider.destroy();
            doc.destroy();
            setSession(null);
            setConnection(initialConnection);
        };
    }, [workspaceId, documentId]);

    // the browser asks "leave this page?" while edits made offline have not reached the server yet
    useEffect(()=>{
        const warn = (event)=>{
            if(connection.unsyncedChanges){
                event.preventDefault();
                event.returnValue = "";
            }
        }
        window.addEventListener("beforeunload", warn);
        return ()=> window.removeEventListener("beforeunload", warn);
    }, [connection.unsyncedChanges]);

    if(!session) return null;

    return (
        <CollaborativeEditor
            session={session}
            connection={connection}
            canEditPermission={canEditPermission}
            userName={userName}
        />
    );
}

const CollaborativeEditor = ({ session, connection, canEditPermission, userName })=>{
    const { doc, provider } = session;

    const editor = useEditor({
        extensions: [
            // the editor's own undo history is off : with Yjs "undo" must only undo MY edits, not other people's
            StarterKit.configure({ undoRedo: false }),
            Collaboration.configure({ document: doc }),
            // Draws the other people's cursors. The colour set here is only a starting value : the server replaces
            // both name and colour with the real ones before anybody else sees them.
            CollaborationCaret.configure({ provider, user: { name: userName, color: "#64748b" } })
        ],
        editable: false
    });

    // Editable only when the role allows it, the server said so, and the first sync has happened
    // (typing into a still-empty local copy would create a second first paragraph).
    // After that it stays editable even while offline: the edits are kept and merge when the connection is back.
    const gone = ["denied", "deleted"].includes(connection.status);
    const editable = canEditPermission && connection.canEdit && connection.everSynced && !gone;

    useEffect(()=>{
        editor?.setEditable(editable);
    }, [editor, editable]);

    if(!editor) return null;

    return (
        <div>
            {gone && (
                <p
                    role="alert"
                    className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                    {connection.message}
                </p>
            )}
            {!gone && connection.everSynced && !editable && (
                <p className="mb-2 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
                    You have read-only access to this document.
                </p>
            )}
            {connection.status === "offline" && connection.everSynced && (
                <p
                    role="status"
                    className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                    You are offline. Keep working : your changes are kept and will sync when the connection is back.
                </p>
            )}

            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                {editable && <EditorToolbar editor={editor} />}
                <EditorContent editor={editor} className="editor-content p-4" />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Collaborators awareness={provider.awareness} />
                <p role="status" className="text-sm text-slate-500">
                    {connection.status === "connecting" && "Connecting…"}
                    {connection.status === "connected" && "Connected · changes are saved automatically"}
                    {connection.status === "offline" && "Offline"}
                </p>
            </div>
        </div>
    );
}

export default DocumentEditor;
