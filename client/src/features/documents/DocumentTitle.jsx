import { useState } from "react";
import { parseApiError } from "../../utils/formErrors";
import { renameDocument } from "./documentApi";

// The title of a document. Editors can change it; it is saved when the field loses focus or Enter is pressed.
const DocumentTitle = ({ workspaceId, documentId, initialTitle, canEdit })=>{
    const [title, setTitle] = useState(initialTitle);
    const [savedTitle, setSavedTitle] = useState(initialTitle);
    const [error, setError] = useState(null);

    const save = async ()=>{
        if(title === savedTitle) return;
        try{
            await renameDocument(workspaceId, documentId, title);
            setSavedTitle(title.trim());
            setTitle(title.trim());
            setError(null);
        }
        catch(err){
            setError(parseApiError(err).fields.title ?? err.message);
        }
    }

    if(!canEdit) return <h1 className="text-2xl font-bold text-strong">{title}</h1>;

    return (
        <div>
            <input
                aria-label="Document title"
                value={title}
                onChange={(e)=> setTitle(e.target.value)}
                onBlur={save}
                onKeyDown={(e)=> e.key === "Enter" && e.currentTarget.blur()}
                className="w-full rounded-md border border-transparent px-1 py-1 text-2xl font-bold text-strong hover:border-line focus:border-line-strong focus:outline-none"
            />
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}

export default DocumentTitle;
