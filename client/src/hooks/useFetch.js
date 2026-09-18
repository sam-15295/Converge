import { useCallback, useEffect, useRef, useState } from "react";

// Loads data for a screen and keeps it in state.
//   const { data, loading, error, reload } = useFetch((signal)=> getMembers(id, signal), [id])
// - `deps` decides when to load again (for example when the workspace id in the URL changes)
// - reload() loads again on demand, for example after the user changed something
// - the request is cancelled when the component goes away or the deps change, so an old slow
//   answer can never overwrite a newer one
// - `loading` is worked out while rendering ("did the answer for THIS request arrive yet?"),
//   so no state has to be set inside the effect just to say "loading"
export const useFetch = (fetchFn, deps)=>{
    const depsKey = JSON.stringify(deps);
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState({ depsKey: null, attempt: -1, data: null, error: null });

    // always call the newest fetchFn without making it a dependency (callers pass a new arrow function every render)
    const latestFetchFn = useRef(fetchFn);
    useEffect(()=>{
        latestFetchFn.current = fetchFn;
    });

    useEffect(()=>{
        const controller = new AbortController();

        latestFetchFn
            .current(controller.signal)
            .then((data)=> setResult({ depsKey, attempt, data, error: null }))
            .catch((error)=>{
                if(error.name !== "AbortError") setResult({ depsKey, attempt, data: null, error });
            });

        return ()=> controller.abort();
    }, [depsKey, attempt]);

    const reload = useCallback(()=> setAttempt((n)=> n + 1), []);

    // The old answer is kept while reloading the SAME thing (no flashing), but never shown for a different one
    // (for example the previous workspace while the next one loads).
    const sameThing = result.depsKey === depsKey;
    return {
        data: sameThing ? result.data : null,
        error: sameThing ? result.error : null,
        loading: !sameThing || result.attempt !== attempt,
        reload
    };
}
