import { useState } from "react";
import RoleBadge from "../../components/RoleBadge";
import { useFetch } from "../../hooks/useFetch";
import { acceptInvite, declineInvite, getMyInvites } from "./workspaceApi";

// Invitations addressed to the logged in user. Renders nothing when there are none.
const MyInvites = ({ onAccepted })=>{
    const { data, reload } = useFetch((signal)=> getMyInvites(signal), []);
    const [error, setError] = useState(null);

    const respond = async (action, invite)=>{
        setError(null);
        try{
            await action(invite.id);
            if(action === acceptInvite) onAccepted();
        }
        catch(err){
            setError(err.message);
        }
        reload(); // also after a failure, the invitation may be gone already
    }

    const invites = data?.invites ?? [];
    if(invites.length === 0 && !error) return null;

    return (
        <section className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">Invitations for you</h2>
            {error && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                    {error}
                </p>
            )}
            <ul className="mt-3 space-y-3">
                {invites.map((invite)=> (
                    <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="font-medium text-slate-900">{invite.workspace.name}</p>
                            <p className="text-sm text-slate-600">
                                {invite.invitedBy} invited you as <RoleBadge role={invite.role} />
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={()=> respond(acceptInvite, invite)}
                                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                            >
                                Accept
                            </button>
                            <button
                                type="button"
                                onClick={()=> respond(declineInvite, invite)}
                                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
                            >
                                Decline
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default MyInvites;
