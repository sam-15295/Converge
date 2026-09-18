import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import FullPageMessage from "../components/FullPageMessage";
import RoleBadge from "../components/RoleBadge";
import InviteForm from "../features/workspace/InviteForm";
import MemberList from "../features/workspace/MemberList";
import PendingInvites from "../features/workspace/PendingInvites";
import WorkspaceSettings from "../features/workspace/WorkspaceSettings";
import { getMembers, getWorkspace } from "../features/workspace/workspaceApi";
import { useFetch } from "../hooks/useFetch";

const Section = ({ title, children })=>{
    return (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
            {children}
        </section>
    );
}

const WorkspacePage = ()=>{
    const { workspaceId } = useParams();
    const details = useFetch((signal)=> getWorkspace(workspaceId, signal), [workspaceId]);
    const people = useFetch((signal)=> getMembers(workspaceId, signal), [workspaceId]);
    const [invitesRefresh, setInvitesRefresh] = useState(0);

    if(details.loading && !details.data) return <FullPageMessage>Loading…</FullPageMessage>;

    if(details.error){
        // the server answers 404 both for "does not exist" and "you are not a member"
        const notFound = details.error.status === 404;
        return (
            <FullPageMessage>
                <span className="text-center">
                    {notFound ? "This workspace does not exist, or you are not a member of it." : details.error.message}
                    <br />
                    <Link to="/" className="mt-3 inline-block font-medium text-slate-900 underline">
                        Back to your workspaces
                    </Link>
                </span>
            </FullPageMessage>
        );
    }

    const { workspace, role, permissions, assignableRoles } = details.data;
    const members = people.data?.members ?? [];

    return (
        <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
            <Link to="/" className="text-sm text-slate-600 underline">
                ← Your workspaces
            </Link>

            <header className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{workspace.name}</h1>
                <RoleBadge role={role} />
            </header>
            {workspace.description && <p className="mt-1 text-slate-600">{workspace.description}</p>}

            <Section title={`Members (${members.length})`}>
                <MemberList
                    workspaceId={workspaceId}
                    members={members}
                    assignableRoles={assignableRoles}
                    onChanged={people.reload}
                />
            </Section>

            {permissions.includes("invite:create") && assignableRoles.length > 0 && (
                <Section title="Invite people">
                    <InviteForm
                        workspaceId={workspaceId}
                        assignableRoles={assignableRoles}
                        onInvited={()=> setInvitesRefresh((n)=> n + 1)}
                    />
                </Section>
            )}

            {permissions.includes("invite:view") && (
                <Section title="Pending invitations">
                    <PendingInvites
                        workspaceId={workspaceId}
                        canCancel={permissions.includes("invite:revoke")}
                        refreshKey={invitesRefresh}
                    />
                </Section>
            )}

            <Section title="Settings">
                <WorkspaceSettings
                    workspace={workspace}
                    role={role}
                    permissions={permissions}
                    onRenamed={details.reload}
                />
            </Section>
        </main>
    );
}

export default WorkspacePage;
