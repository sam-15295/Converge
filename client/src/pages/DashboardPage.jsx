import { useState } from "react";
import { Link } from "react-router-dom";
import RoleBadge from "../components/RoleBadge";
import { useAuth } from "../features/auth/AuthContext";
import ProfileForm from "../features/auth/ProfileForm";
import CreateWorkspaceForm from "../features/workspace/CreateWorkspaceForm";
import MyInvites from "../features/workspace/MyInvites";
import { getMyWorkspaces } from "../features/workspace/workspaceApi";
import { useFetch } from "../hooks/useFetch";

// Home of a logged in user: their workspaces, invitations waiting for them, and their profile.
const DashboardPage = ()=>{
    const { user, logout } = useAuth();
    const [logoutError, setLogoutError] = useState(null);
    const workspaces = useFetch((signal)=> getMyWorkspaces(signal), []);

    const handleLogout = async ()=>{
        setLogoutError(null);
        try{
            await logout();
        }
        catch(err){
            setLogoutError(err.message);
        }
    }

    const list = workspaces.data?.workspaces ?? [];

    return (
        <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
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

            <MyInvites onAccepted={workspaces.reload} />

            <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Your workspaces</h2>
                {workspaces.error && (
                    <p role="alert" className="text-sm text-red-600">
                        {workspaces.error.message}
                    </p>
                )}
                {!workspaces.error && list.length === 0 && !workspaces.loading && (
                    <p className="text-sm text-slate-500">You are not in any workspace yet. Create one below.</p>
                )}
                <ul className="divide-y divide-slate-100">
                    {list.map((workspace)=> (
                        <li key={workspace.id}>
                            <Link
                                to={`/workspace/${workspace.id}`}
                                className="flex items-center justify-between py-3 hover:bg-slate-50"
                            >
                                <span>
                                    <span className="font-medium text-slate-900">{workspace.name}</span>
                                    {workspace.description && (
                                        <span className="block text-sm text-slate-500">{workspace.description}</span>
                                    )}
                                </span>
                                <RoleBadge role={workspace.role} />
                            </Link>
                        </li>
                    ))}
                </ul>
                <div className="mt-4 border-t border-slate-100 pt-4">
                    <CreateWorkspaceForm onCreated={workspaces.reload} />
                </div>
            </section>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Profile</h2>
                <ProfileForm />
            </section>

            <p className="mt-6 text-sm text-slate-500">
                <Link to="/status" className="underline">
                    System status
                </Link>
            </p>
        </main>
    );
}

export default DashboardPage;
