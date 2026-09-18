const STYLES = {
    ok: "bg-emerald-100 text-emerald-800",
    connected: "bg-emerald-100 text-emerald-800",
    loading: "bg-slate-100 text-slate-600",
    degraded: "bg-amber-100 text-amber-800",
    unreachable: "bg-red-100 text-red-800",
    disconnected: "bg-red-100 text-red-800"
};

const StatusBadge = ({ status })=>{
    const style = STYLES[status] ?? "bg-slate-100 text-slate-600";
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{status}</span>;
}

export default StatusBadge;
