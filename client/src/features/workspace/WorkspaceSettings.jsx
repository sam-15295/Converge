import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FormField from "../../components/FormField";
import { parseApiError } from "../../utils/formErrors";
import { deleteWorkspace, leaveWorkspace, updateWorkspace } from "./workspaceApi";

// Rename, leave and delete. Each part is shown only when the server said the user may do it.
const WorkspaceSettings = ({ workspace, role, permissions, onRenamed })=>{
    const navigate = useNavigate();
    const [name, setName] = useState(workspace.name);
    const [errors, setErrors] = useState({ fields: {}, form: null });
    const [saved, setSaved] = useState(false);
    const [dangerError, setDangerError] = useState(null);

    const handleRename = async (event)=>{
        event.preventDefault();
        setSaved(false);
        try{
            await updateWorkspace(workspace.id, { name });
            setErrors({ fields: {}, form: null });
            setSaved(true);
            onRenamed();
        }
        catch(err){
            setErrors(parseApiError(err));
        }
    }

    const leaveOrDelete = async (action, question)=>{
        if(!window.confirm(question)) return;
        setDangerError(null);
        try{
            await action(workspace.id);
            navigate("/");
        }
        catch(err){
            setDangerError(err.message);
        }
    }

    const canRename = permissions.includes("workspace:update");
    const canDelete = permissions.includes("workspace:delete");
    const canLeave = role !== "OWNER"; // the owner cannot leave, they can delete the workspace instead

    if(!canRename && !canDelete && !canLeave) return null;

    return (
        <div className="space-y-5">
            {canRename && (
                <form onSubmit={handleRename} className="space-y-3" noValidate>
                    <FormField
                        id="renameWorkspace"
                        label="Workspace name"
                        value={name}
                        onChange={(e)=> setName(e.target.value)}
                        error={errors.fields.name}
                    />
                    {errors.form && (
                        <p role="alert" className="text-sm text-danger">
                            {errors.form}
                        </p>
                    )}
                    {saved && (
                        <p role="status" className="text-sm text-success">
                            Saved
                        </p>
                    )}
                    <button
                        type="submit"
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
                    >
                        Save name
                    </button>
                </form>
            )}

            {dangerError && (
                <p role="alert" className="text-sm text-danger">
                    {dangerError}
                </p>
            )}
            <div className="flex flex-wrap gap-2">
                {canLeave && (
                    <button
                        type="button"
                        onClick={()=> leaveOrDelete(leaveWorkspace, `Leave "${workspace.name}"?`)}
                        className="rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-body hover:bg-raised"
                    >
                        Leave workspace
                    </button>
                )}
                {canDelete && (
                    <button
                        type="button"
                        onClick={() =>
                            leaveOrDelete(
                                deleteWorkspace,
                                `Delete "${workspace.name}" for everyone? This cannot be undone.`
                            )
                        }
                        className="rounded-md border border-danger-line px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-bg"
                    >
                        Delete workspace
                    </button>
                )}
            </div>
        </div>
    );
}

export default WorkspaceSettings;
