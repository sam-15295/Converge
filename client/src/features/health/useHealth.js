import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../services/api";

// Checks GET /api/health once on mount (and again when refetch() is called).
// status: 'loading' | 'ok' | 'degraded' (server up, database down) | 'unreachable' (server down)
export const useHealth = ()=>{
    const [state, setState] = useState({ status: "loading", data: null });
    const [attempt, setAttempt] = useState(0);

    useEffect(()=>{
        const controller = new AbortController();

        apiRequest("/health", { signal: controller.signal })
            .then((data)=> setState({ status: data.status, data }))
            .catch((err)=>{
                if(err.name === "AbortError") return;
                // The server answers 503 (with a body) when it is running but the database is down.
                if(err.status === 503 && err.body?.database){
                    setState({ status: err.body.status, data: err.body });
                    return;
                }
                setState({ status: "unreachable", data: null });
            });

        return ()=> controller.abort();
    }, [attempt]);

    const refetch = useCallback(()=>{
        setState({ status: "loading", data: null });
        setAttempt((n)=> n + 1);
    }, []);

    return { ...state, refetch };
}
