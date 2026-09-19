import { useState } from "react";
import FormField from "../../components/FormField";
import { parseApiError } from "../../utils/formErrors";
import { createDocument } from "./documentApi";

// Creates a document, then hands it to the caller (the workspace page opens it in the editor).
const CreateDocumentForm = ({ workspaceId, onCreated })=>{
    const [title, setTitle] = useState("");
    const [errors, setErrors] = useState({ fields: {}, form: null });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event)=>{
        event.preventDefault();
        setSubmitting(true);
        setErrors({ fields: {}, form: null });
        try{
            const data = await createDocument(workspaceId, { title });
            onCreated(data.document);
        }
        catch(err){
            setErrors(parseApiError(err));
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <FormField
                id="documentTitle"
                label="New document title"
                value={title}
                onChange={(e)=> setTitle(e.target.value)}
                error={errors.fields.title}
            />
            {errors.form && (
                <p role="alert" className="text-sm text-red-600">
                    {errors.form}
                </p>
            )}
            <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
                Create document
            </button>
        </form>
    );
}

export default CreateDocumentForm;
