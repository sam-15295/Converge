import { useState } from "react";
import FormField from "../../components/FormField";
import { parseApiError } from "../../utils/formErrors";
import { createInvite } from "./workspaceApi";

// Invite someone by email. The role list only contains roles below the user's own.
const InviteForm = ({ workspaceId, assignableRoles, onInvited })=>{
    const [email, setEmail] = useState("");
    const [role, setRole] = useState(assignableRoles[assignableRoles.length - 1]); // the weakest role is the safest default
    const [errors, setErrors] = useState({ fields: {}, form: null });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event)=>{
        event.preventDefault();
        setSubmitting(true);
        setErrors({ fields: {}, form: null });
        try{
            await createInvite(workspaceId, { email, role });
            setEmail("");
            onInvited();
        }
        catch(err){
            setErrors(parseApiError(err));
        }
        setSubmitting(false);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <FormField
                id="inviteEmail"
                label="Invite by email"
                type="email"
                value={email}
                onChange={(e)=> setEmail(e.target.value)}
                error={errors.fields.email}
            />
            <div>
                <label htmlFor="inviteRole" className="block text-sm font-medium text-body">
                    Role
                </label>
                <select
                    id="inviteRole"
                    value={role}
                    onChange={(e)=> setRole(e.target.value)}
                    className="mt-1 block rounded-md border border-line-strong px-3 py-2 text-sm"
                >
                    {assignableRoles.map((option)=> (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
                {errors.fields.role && <p className="mt-1 text-sm text-danger">{errors.fields.role}</p>}
            </div>
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
                Send invitation
            </button>
        </form>
    );
}

export default InviteForm;
