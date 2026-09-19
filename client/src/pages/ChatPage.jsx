import { Link, useParams } from "react-router-dom";
import FullPageMessage from "../components/FullPageMessage";
import RoleBadge from "../components/RoleBadge";
import { useAuth } from "../features/auth/AuthContext";
import ChatRoom from "../features/chat/ChatRoom";
import { getMembers, getWorkspace } from "../features/workspace/workspaceApi";
import { useFetch } from "../hooks/useFetch";

const ChatPage = ()=>{
    const { workspaceId } = useParams();
    const { user } = useAuth();
    const details = useFetch((signal)=> getWorkspace(workspaceId, signal), [workspaceId]);
    const people = useFetch((signal)=> getMembers(workspaceId, signal), [workspaceId]);

    if((details.loading && !details.data) || (people.loading && !people.data)){
        return <FullPageMessage>Loading…</FullPageMessage>;
    }

    const error = details.error ?? people.error;
    if(error){
        // the server answers 404 both for "does not exist" and "you are not a member"
        const notFound = error.status === 404;
        return (
            <FullPageMessage>
                <span className="text-center">
                    {notFound ? "This workspace does not exist, or you are not a member of it." : error.message}
                    <br />
                    <Link to="/" className="mt-3 inline-block font-medium text-slate-900 underline">
                        Back to your workspaces
                    </Link>
                </span>
            </FullPageMessage>
        );
    }

    const { workspace, role } = details.data;

    return (
        <main className="mx-auto flex h-dvh max-w-5xl flex-col px-4 py-6">
            <Link to={`/workspace/${workspaceId}`} className="text-sm text-slate-600 underline">
                ← {workspace.name}
            </Link>

            <header className="mt-2 mb-3 flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900">{workspace.name} · Chat</h1>
                <RoleBadge role={role} />
            </header>

            <ChatRoom
                key={workspaceId}
                workspaceId={workspaceId}
                currentUserId={user.id}
                members={people.data.members}
            />
        </main>
    );
}

export default ChatPage;
