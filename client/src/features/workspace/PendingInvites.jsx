import { useState } from "react";
import RoleBadge from "../../components/RoleBadge";
import { useFetch } from "../../hooks/useFetch";
import { cancelInvite, getWorkspaceInvites } from "./workspaceApi";

// The invitations of one workspace that nobody has answered yet (only OWNER and ADMIN may see them).
// `refreshKey` changes when a new invitation was sent, which loads the list again.
const PendingInvites = ({ workspaceId, canCancel, refreshKey })=>{
    const { data, reload } = useFetch((signal)=> getWorkspaceInvites(workspaceId, signal), [workspaceId, refreshKey]);
    const [error, setError] = useState(null);

    const handleCancel = async (invite)=>{
        setError(null);
        try{
            await cancelInvite(workspaceId, invite.id);
        }
        catch(err){
            setError(err.message);
        }
        reload();
    }

    const invites = data?.invites ?? [];

    return (
        <div>
            {error && (
                <p role="alert" className="mb-2 text-sm text-red-600">
                    {error}
                </p>
            )}
            {invites.length === 0 ? (
                <p className="text-sm text-slate-500">No pending invitations.</p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {invites.map((invite)=> (
                        <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <span className="text-sm text-slate-700">
                                {invite.email} <RoleBadge role={invite.role} />
                            </span>
                            {canCancel && (
                                <button
                                    type="button"
                                    onClick={()=> handleCancel(invite)}
                                    className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
                                >
                                    Cancel
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default PendingInvites;
