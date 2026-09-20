import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

// Shows what a document looked like in one version.
//
// It uses the SAME editor as the real document, only switched off (editable : false). So the old text is drawn by the
// editor from its tree, exactly as it looked then, and nothing is ever put on the page as HTML.
const VersionPreview = ({ content })=>{
    const editor = useEditor({
        extensions: [StarterKit],
        content,
        editable: false
    }, [content]);

    return (
        <div className="rounded-md border border-line bg-surface p-4">
            <EditorContent editor={editor} className="tiptap-readonly" />
        </div>
    );
}

export default VersionPreview;
