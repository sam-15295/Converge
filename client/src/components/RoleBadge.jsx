const STYLES = {
    OWNER: "bg-purple-100 text-purple-800",
    ADMIN: "bg-blue-100 text-blue-800",
    MEMBER: "bg-emerald-100 text-emerald-800",
    VIEWER: "bg-slate-100 text-slate-600"
};

const RoleBadge = ({ role })=>{
    return (
        <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[role] ?? STYLES.VIEWER}`}
        >
            {role}
        </span>
    );
}

export default RoleBadge;
