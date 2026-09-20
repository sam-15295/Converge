import { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import FormField from "../components/FormField";
import { useAuth } from "../features/auth/AuthContext";
import { parseApiError } from "../utils/formErrors";

const SignupPage = ()=>{
    const { signup } = useAuth();
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [errors, setErrors] = useState({ fields: {}, form: null });
    const [submitting, setSubmitting] = useState(false);

    const setField = (name)=> (event)=> setForm((prev)=> ({ ...prev, [name]: event.target.value }));

    const handleSubmit = async (event)=>{
        event.preventDefault();
        setSubmitting(true);
        setErrors({ fields: {}, form: null });
        try{
            await signup(form);
            // On success <PublicOnlyRoute> sees the new session and redirects.
        }
        catch(err){
            setErrors(parseApiError(err));
            setSubmitting(false);
        }
    }

    return (
        <AuthCard
            title="Create your account"
            subtitle="Start collaborating with your team"
            footer={
                <>
                    Already have an account?{" "}
                    <Link to="/login" className="font-medium text-strong underline">
                        Log in
                    </Link>
                </>
            }
        >
            {/* noValidate: the server is the source of truth for validation, and its messages are shown per field. */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <FormField
                    id="name"
                    label="Name"
                    autoComplete="name"
                    value={form.name}
                    onChange={setField("name")}
                    error={errors.fields.name}
                />
                <FormField
                    id="email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={setField("email")}
                    error={errors.fields.email}
                />
                <FormField
                    id="password"
                    label="Password (at least 8 characters)"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={setField("password")}
                    error={errors.fields.password}
                />
                {errors.form && (
                    <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
                        {errors.form}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
                >
                    {submitting ? "Creating account…" : "Create account"}
                </button>
            </form>
        </AuthCard>
    );
}

export default SignupPage;
