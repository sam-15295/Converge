import { useState } from "react";
import FormField from "../../components/FormField";
import { parseApiError } from "../../utils/formErrors";
import { createWorkspace } from "./workspaceApi";

const CreateWorkspaceForm = ({ onCreated })=>{
    const [name, setName] = useState("");
    const [errors, setErrors] = useState({ fields: {}, form: null });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event)=>{
        event.preventDefault();
        setSubmitting(true);
        setErrors({ fields: {}, form: null });
        try{
            await createWorkspace({ name });
            setName("");
            onCreated();
        }
        catch(err){
            setErrors(parseApiError(err));
        }
        setSubmitting(false);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <FormField
                id="workspaceName"
                label="New workspace name"
                value={name}
                onChange={(e)=> setName(e.target.value)}
                error={errors.fields.name}
            />
            {errors.form && (
                <p role="alert" className="text-sm text-danger">
                    {errors.form}
                </p>
            )}
            <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
            >
                Create workspace
            </button>
        </form>
    );
}

export default CreateWorkspaceForm;
