const STYLES = {
    OWNER: "bg-accent-chip text-accent",
    ADMIN: "bg-info-chip text-info",
    MEMBER: "bg-success-bg text-success",
    VIEWER: "bg-raised text-body"
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
