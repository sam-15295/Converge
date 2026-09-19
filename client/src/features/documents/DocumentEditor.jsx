import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useAutosave } from "../../hooks/useAutosave";
import { saveContent } from "./documentApi";
import EditorToolbar from "./EditorToolbar";

const STATUS_TEXT = {
    saved: "All changes saved",
    unsaved: "Unsaved changes…",
    saving: "Saving…"
};

// The rich-text editor (TipTap). It is given the content ONCE when it opens, then keeps its own state.
// `editable` false = read-only (VIEWER): no toolbar, no saving.
const DocumentEditor = ({
    workspaceId,
    documentId,
    initialContent,
    initialVersion,
    editable,
    onReloadRequested
})=>{
    // The version this editor's content is based on. Every successful save returns the next one.
    const versionRef = useRef(initialVersion);
    const editorRef = useRef(null);

    const { status, error, markChanged, retry } = useAutosave(async ()=>{
        const response = await saveContent(workspaceId, documentId, {
            content: editorRef.current.getJSON(),
            version: versionRef.current
        });
        versionRef.current = response.version;
    }, 1000);

    const editor = useEditor({
        extensions: [StarterKit],
        content: initialContent,
        editable,
        onUpdate: ()=> markChanged()
    });

    useEffect(()=>{
        editorRef.current = editor;
    }, [editor]);

    // the browser asks "leave this page?" while something is not saved yet
    useEffect(()=>{
        const warn = (event)=>{
            if(status !== "saved"){
                event.preventDefault();
                event.returnValue = "";
            }
        }
        window.addEventListener("beforeunload", warn);
        return ()=> window.removeEventListener("beforeunload", warn);
    }, [status]);

    if(!editor) return null;

    return (
        <div>
            {!editable && (
                <p className="mb-2 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
                    You have read-only access to this document.
                </p>
            )}

            {status === "conflict" && (
                <div
                    role="alert"
                    className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                    Someone else saved a newer version of this document, so your latest changes were{" "}
                    <strong>not</strong> saved.
                    <button
                        type="button"
                        onClick={onReloadRequested}
                        className="ml-2 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
                    >
                        Load the latest version
                    </button>
                </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                {editable && <EditorToolbar editor={editor} />}
                <EditorContent editor={editor} className="editor-content p-4" />
            </div>

            {editable && status !== "conflict" && (
                <p role="status" className="mt-2 text-sm text-slate-500">
                    {status === "error" ? (
                        <span className="text-red-600">
                            Could not save ({error}).
                            <button type="button" onClick={retry} className="ml-2 underline">
                                Try again
                            </button>
                        </span>
                    ) : (
                        STATUS_TEXT[status]
                    )}
                </p>
            )}
        </div>
    );
}

export default DocumentEditor;
