const STYLES = {
    ok: "bg-success-bg text-success",
    connected: "bg-success-bg text-success",
    loading: "bg-raised text-body",
    // not a fault : Redis is optional, and one server needs none
    disabled: "bg-raised text-muted",
    connecting: "bg-warn-bg text-warn",
    degraded: "bg-warn-bg text-warn",
    unreachable: "bg-danger-bg text-danger",
    disconnected: "bg-danger-bg text-danger"
};

const StatusBadge = ({ status })=>{
    const style = STYLES[status] ?? "bg-raised text-body";
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{status}</span>;
}

export default StatusBadge;
