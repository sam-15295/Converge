import StatusBadge from "../components/StatusBadge";
import { useHealth } from "../features/health/useHealth";

const StatusPage = ()=>{
    const { status, data, refetch } = useHealth();

    // If we got any response at all, the API itself is up (even when the DB is down).
    const apiStatus = status === "loading" || status === "unreachable" ? status : "ok";
    const dbStatus = data?.database ?? (status === "loading" ? "loading" : "unreachable");

    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
            <h1 className="text-3xl font-bold text-slate-900">Converge</h1>
            <p className="mt-1 text-slate-600">Real-time collaborative workspace</p>

            <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">System status</h2>

                <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                        <dt className="text-slate-700">Backend API</dt>
                        <dd>
                            <StatusBadge status={apiStatus} />
                        </dd>
                    </div>
                    <div className="flex items-center justify-between">
                        <dt className="text-slate-700">MongoDB</dt>
                        <dd>
                            <StatusBadge status={dbStatus} />
                        </dd>
                    </div>
                </dl>

                <button
                    type="button"
                    onClick={refetch}
                    className="mt-5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                >
                    Check again
                </button>
            </section>
        </main>
    );
}

export default StatusPage;
