import { useState } from "react";
import FormField from "../../components/FormField";
import { parseApiError } from "../../utils/formErrors";
import { useAuth } from "./AuthContext";

const ProfileForm = ()=>{
    const { user, updateProfile } = useAuth();
    const [name, setName] = useState(user.name);
    const [errors, setErrors] = useState({ fields: {}, form: null });
    const [saved, setSaved] = useState(false);

    const handleSubmit = async (event)=>{
        event.preventDefault();
        setSaved(false);
        try{
            await updateProfile({ name });
            setErrors({ fields: {}, form: null });
            setSaved(true);
        }
        catch(err){
            setErrors(parseApiError(err));
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <FormField
                id="name"
                label="Display name"
                value={name}
                onChange={(e)=> setName(e.target.value)}
                error={errors.fields.name}
            />
            {errors.form && (
                <p role="alert" className="text-sm text-red-600">
                    {errors.form}
                </p>
            )}
            {saved && (
                <p role="status" className="text-sm text-emerald-700">
                    Saved
                </p>
            )}
            <button
                type="submit"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
                Save name
            </button>
        </form>
    );
}

export default ProfileForm;
