import { useCallback, useEffect, useRef, useState } from "react";

// Saves automatically a moment after the user stops changing something.
//   const { status, error, markChanged, retry } = useAutosave(saveFn, 1000)
// - call markChanged() on every change. The save runs `delay` ms after the LAST change.
// - saveFn is your own async function (it reads the latest content itself). It throws on failure.
// - status : "saved" | "unsaved" | "saving" | "error" | "conflict"
//
// Rules that keep it correct :
// - ONE save at a time. A save is based on the version the previous save returned, so two saves in
//   flight would both use the same version and the second would wrongly conflict with the first.
// - if the user changes something WHILE a save runs, another save follows right after it.
// - a 409 ("someone else saved") stops autosaving for good : saving again would just fail again.
//   The screen has to reload the latest version.
// - on other errors the change stays "dirty", so the next change (or retry()) tries again.
// - when the screen goes away with unsaved changes, one last save is attempted.
export const useAutosave = (saveFn, delay = 1000)=>{
    const [status, setStatus] = useState("saved");
    const [error, setError] = useState(null);

    const latestSaveFn = useRef(saveFn);
    useEffect(()=>{
        latestSaveFn.current = saveFn;
    });

    const timer = useRef(null);
    const saving = useRef(false);
    const dirty = useRef(false);
    const stopped = useRef(false); // true after a conflict
    const runSave = useRef(null);

    useEffect(()=>{
        runSave.current = async ()=>{
            if(saving.current || stopped.current) return; // a running save starts the next one itself
            dirty.current = false;
            saving.current = true;
            setStatus("saving");
            setError(null);

            try{
                await latestSaveFn.current();
            }
            catch(err){
                saving.current = false;
                if(err.status === 409){
                    stopped.current = true;
                    setStatus("conflict");
                } else {
                    dirty.current = true;
                    setError(err.message);
                    setStatus("error");
                }
                return;
            }

            saving.current = false;
            if(dirty.current){
                runSave.current(); // something changed while saving
            } else {
                setStatus("saved");
            }
        };
    });

    const markChanged = useCallback(()=>{
        if(stopped.current) return;
        dirty.current = true;
        setStatus("unsaved");
        clearTimeout(timer.current);
        timer.current = setTimeout(()=> runSave.current(), delay);
    }, [delay]);

    const retry = useCallback(()=> runSave.current(), []);

    // leaving the screen : do not lose the last change
    useEffect(()=>{
        return ()=>{
            clearTimeout(timer.current);
            if(dirty.current && !saving.current && !stopped.current) runSave.current();
        };
    }, []);

    return { status, error, markChanged, retry };
}
