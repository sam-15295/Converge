import { useEditorState } from "@tiptap/react";

// The formatting buttons. Which of them look "pressed" follows the cursor, so the toolbar reads the editor's state.
const EditorToolbar = ({ editor })=>{
    const state = useEditorState({
        editor,
        selector: ({ editor })=> ({
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            strike: editor.isActive("strike"),
            code: editor.isActive("code"),
            link: editor.isActive("link"),
            h1: editor.isActive("heading", { level: 1 }),
            h2: editor.isActive("heading", { level: 2 }),
            h3: editor.isActive("heading", { level: 3 }),
            bulletList: editor.isActive("bulletList"),
            orderedList: editor.isActive("orderedList"),
            blockquote: editor.isActive("blockquote"),
            codeBlock: editor.isActive("codeBlock"),
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo()
        })
    });

    const setLink = ()=>{
        const previous = editor.getAttributes("link").href ?? "";
        const href = window.prompt(
            "Link address (for example https://example.com). Leave empty to remove the link.",
            previous
        );
        if(href === null) return; // cancelled
        if(href.trim() === ""){
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
        } else {
            editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
        }
    }

    const chain = ()=> editor.chain().focus();

    const buttons = [
        {
            label: "B",
            title: "Bold",
            active: state.bold,
            run: ()=> chain().toggleBold().run(),
            className: "font-bold"
        },
        {
            label: "I",
            title: "Italic",
            active: state.italic,
            run: ()=> chain().toggleItalic().run(),
            className: "italic"
        },
        {
            label: "S",
            title: "Strikethrough",
            active: state.strike,
            run: ()=> chain().toggleStrike().run(),
            className: "line-through"
        },
        {
            label: "<>",
            title: "Inline code",
            active: state.code,
            run: ()=> chain().toggleCode().run(),
            className: "font-mono"
        },
        { label: "Link", title: "Link", active: state.link, run: setLink },
        { divider: true },
        { label: "H1", title: "Heading 1", active: state.h1, run: ()=> chain().toggleHeading({ level: 1 }).run() },
        { label: "H2", title: "Heading 2", active: state.h2, run: ()=> chain().toggleHeading({ level: 2 }).run() },
        { label: "H3", title: "Heading 3", active: state.h3, run: ()=> chain().toggleHeading({ level: 3 }).run() },
        { divider: true },
        {
            label: "• List",
            title: "Bullet list",
            active: state.bulletList,
            run: ()=> chain().toggleBulletList().run()
        },
        {
            label: "1. List",
            title: "Numbered list",
            active: state.orderedList,
            run: ()=> chain().toggleOrderedList().run()
        },
        { label: "Quote", title: "Quote", active: state.blockquote, run: ()=> chain().toggleBlockquote().run() },
        { label: "Code", title: "Code block", active: state.codeBlock, run: ()=> chain().toggleCodeBlock().run() },
        { label: "—", title: "Horizontal line", active: false, run: ()=> chain().setHorizontalRule().run() },
        { divider: true },
        { label: "Undo", title: "Undo", active: false, disabled: !state.canUndo, run: ()=> chain().undo().run() },
        { label: "Redo", title: "Redo", active: false, disabled: !state.canRedo, run: ()=> chain().redo().run() }
    ];

    return (
        <div
            role="toolbar"
            aria-label="Formatting"
            className="flex flex-wrap items-center gap-1 border-b border-line p-2"
        >
            {buttons.map((button, index) =>
                button.divider ? (
                    <span key={index} className="mx-1 h-5 w-px bg-elevated" aria-hidden="true" />
                ) : (
                    <button
                        key={button.title}
                        type="button"
                        title={button.title}
                        aria-label={button.title}
                        aria-pressed={button.active}
                        disabled={button.disabled}
                        // onMouseDown + preventDefault keeps the text selection in the editor when a button is pressed
                        onMouseDown={(e)=> e.preventDefault()}
                        onClick={button.run}
                        className={`rounded px-2 py-1 text-sm hover:bg-raised disabled:opacity-40 ${button.className ?? ""} ${
                            button.active ? "bg-elevated text-strong" : "text-body"
                        }`}
                    >
                        {button.label}
                    </button>
                )
            )}
        </div>
    );
}

export default EditorToolbar;
