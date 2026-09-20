import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import { useHealth } from "../features/health/useHealth";

const StatusPage = ()=>{
    const { status, data, refetch } = useHealth();

    // If we got any response at all, the API itself is up (even when the DB is down).
    const apiStatus = status === "loading" || status === "unreachable" ? status : "ok";
    const dbStatus = data?.database ?? (status === "loading" ? "loading" : "unreachable");

    // Redis is optional : "disabled" is a normal answer, not a fault, so it is not shown as a problem.
    const redis = data?.redis ?? (status === "loading" ? "loading" : "unreachable");

    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
            <h1 className="text-3xl font-bold text-strong">Converge</h1>
            <p className="mt-1 text-body">Real-time collaborative workspace</p>

            <section className="mt-8 rounded-lg border border-line bg-surface p-5 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">System status</h2>

                <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                        <dt className="text-body">Backend API</dt>
                        <dd>
                            <StatusBadge status={apiStatus} />
                        </dd>
                    </div>
                    <div className="flex items-center justify-between">
                        <dt className="text-body">MongoDB</dt>
                        <dd>
                            <StatusBadge status={dbStatus} />
                        </dd>
                    </div>
                    <div className="flex items-center justify-between">
                        <dt className="text-body">
                            Redis
                            <span className="ml-2 text-xs text-muted">only needed for several servers</span>
                        </dt>
                        <dd>
                            <StatusBadge status={redis} />
                        </dd>
                    </div>
                </dl>

                <button
                    type="button"
                    onClick={refetch}
                    className="mt-5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
                >
                    Check again
                </button>
            </section>

            <p className="mt-4 text-center text-sm">
                <Link to="/" className="text-muted underline hover:text-body">
                    Back to Converge
                </Link>
            </p>
        </main>
    );
}

export default StatusPage;
