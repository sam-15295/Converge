import { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import FormField from "../components/FormField";
import { useAuth } from "../features/auth/AuthContext";
import { parseApiError } from "../utils/formErrors";

const LoginPage = ()=>{
    const { login } = useAuth();
    const [form, setForm] = useState({ email: "", password: "" });
    const [errors, setErrors] = useState({ fields: {}, form: null });
    const [submitting, setSubmitting] = useState(false);

    const setField = (name)=> (event)=> setForm((prev)=> ({ ...prev, [name]: event.target.value }));

    const handleSubmit = async (event)=>{
        event.preventDefault();
        setSubmitting(true);
        setErrors({ fields: {}, form: null });
        try{
            await login(form);
            // Nothing to do on success: <PublicOnlyRoute> sees the new session and redirects.
        }
        catch(err){
            setErrors(parseApiError(err));
            setSubmitting(false);
        }
    }

    return (
        <AuthCard
            title="Log in to Converge"
            subtitle="Welcome back"
            footer={
                <>
                    No account yet?{" "}
                    <Link to="/signup" className="font-medium text-slate-900 underline">
                        Sign up
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={setField("password")}
                    error={errors.fields.password}
                />
                {errors.form && (
                    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                        {errors.form}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                >
                    {submitting ? "Logging in…" : "Log in"}
                </button>
            </form>
        </AuthCard>
    );
}

export default LoginPage;
