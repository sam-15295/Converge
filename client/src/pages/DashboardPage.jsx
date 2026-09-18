import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import ProfileForm from "../features/auth/ProfileForm";

// Placeholder home for logged-in users. Phase 3 replaces this with the workspace list.
const DashboardPage = ()=>{
    const { user, logout } = useAuth();
    const [logoutError, setLogoutError] = useState(null);

    const handleLogout = async ()=>{
        setLogoutError(null);
        try{
            await logout();
        }
        catch(err){
            setLogoutError(err.message);
        }
    }

    return (
        <main className="mx-auto min-h-screen max-w-md px-4 py-12">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name}</h1>
                    <p className="text-sm text-slate-600">{user.email}</p>
                </div>
                <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                    Log out
                </button>
            </header>
            {logoutError && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                    {logoutError}
                </p>
            )}

            <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Profile</h2>
                <ProfileForm />
            </section>

            <p className="mt-6 text-sm text-slate-500">
                Workspaces are coming in the next phase.{" "}
                <Link to="/status" className="underline">
                    System status
                </Link>
            </p>
        </main>
    );
}

export default DashboardPage;
