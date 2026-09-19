// Everybody in the workspace, the people who have the chat open right now first, each with a green or grey dot.
// Online means "has this workspace's chat open in some tab", which the server tracks (it is never saved).
const OnlinePeople = ({ members, onlineUserIds, currentUserId })=>{
    const online = new Set(onlineUserIds);
    const sorted = [...members].sort(
        (a, b)=> Number(online.has(b.userId)) - Number(online.has(a.userId)) || a.name.localeCompare(b.name)
    );

    return (
        <ul aria-label="Members and who is online" className="flex flex-wrap gap-2">
            {sorted.map((member)=>{
                const isOnline = online.has(member.userId);
                return (
                    <li
                        key={member.userId}
                        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-sm text-slate-700"
                    >
                        <span
                            aria-hidden="true"
                            className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-slate-300"}`}
                        />
                        {member.name}
                        {member.userId === currentUserId && <span className="text-slate-500">(you)</span>}
                        <span className="sr-only">{isOnline ? "online" : "offline"}</span>
                    </li>
                );
            })}
        </ul>
    );
}

export default OnlinePeople;
