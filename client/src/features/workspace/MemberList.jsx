import { useState } from "react";
import RoleBadge from "../../components/RoleBadge";
import { changeMemberRole, removeMember } from "./workspaceApi";

// The people in a workspace. The server decides what may be shown for each person:
//   canChangeRole / canRemove  (per member)   and   assignableRoles  (the roles the user may hand out)
// The buttons are only a convenience. The server checks every request again.
const MemberList = ({ workspaceId, members, assignableRoles, onChanged })=>{
    const [error, setError] = useState(null);

    const run = async (action)=>{
        setError(null);
        try{
            await action();
        }
        catch(err){
            setError(err.message);
        }
        onChanged(); // reload also after a failure, the list may have changed meanwhile
    }

    return (
        <div>
            {error && (
                <p role="alert" className="mb-2 text-sm text-danger">
                    {error}
                </p>
            )}
            <ul className="divide-y divide-line">
                {members.map((member)=> (
                    <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div>
                            <p className="font-medium text-strong">{member.name}</p>
                            <p className="text-sm text-muted">{member.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {member.canChangeRole ? (
                                <select
                                    aria-label={`Role of ${member.name}`}
                                    value={member.role}
                                    onChange={(e) =>
                                        run(()=> changeMemberRole(workspaceId, member.userId, e.target.value))
                                    }
                                    className="rounded-md border border-line-strong px-2 py-1 text-sm"
                                >
                                    {assignableRoles.map((role)=> (
                                        <option key={role} value={role}>
                                            {role}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <RoleBadge role={member.role} />
                            )}
                            {member.canRemove && (
                                <button
                                    type="button"
                                    onClick={()=>{
                                        if(window.confirm(`Remove ${member.name} from this workspace?`)){
                                            run(()=> removeMember(workspaceId, member.userId));
                                        }
                                    }}
                                    className="rounded-md border border-danger-line px-2 py-1 text-sm text-danger hover:bg-danger-bg"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default MemberList;
