import { useCallback, useEffect, useReducer, useRef } from "react";
import { getVersion, getVersions, restoreVersion } from "./versionsApi";

const pageSize = 20;

// The state of the history dialog of ONE document. Like the chat and the comments, everything that can happen is an
// action handled in one place.
//
//   versions   the list, newest first        selectedId  which one is being looked at
//   preview    { id, content } the text of the selected version (loaded on demand)
//   loading    the first page has not arrived yet        restoring  a restore is running
//   problem    the last thing that went wrong
const initialState = {
    versions: [],
    hasMore: false,
    loading: true,
    selectedId: null,
    preview: null,
    previewLoading: false,
    restoring: false,
    problem: null
};

const reducer = (state, action)=>{
    switch(action.type){
        case "loaded":
            return { ...state, versions: action.versions, hasMore: action.hasMore, loading: false, problem: null };

        case "more":
            return { ...state, versions: [...state.versions, ...action.versions], hasMore: action.hasMore, problem: null };

        case "select":
            // the preview of the previous one is dropped at once, so the dialog never shows the wrong text under a name
            return { ...state, selectedId: action.versionId, preview: null, previewLoading: true, problem: null };

        case "preview":
            // an answer for a version that is not the one being looked at any more is ignored
            if(action.versionId !== state.selectedId) return state;
            return { ...state, preview: { id: action.versionId, content: action.content }, previewLoading: false };

        case "restoring":
            return { ...state, restoring: action.restoring };

        case "problem":
            return { ...state, problem: action.message, loading: false, previewLoading: false, restoring: false };

        default:
            return state;
    }
}

// `open` : the dialog is showing. The history is only read while it is open, so a closed dialog costs nothing.
export const useVersionHistory = (workspaceId, documentId, open)=>{
    const [state, dispatch] = useReducer(reducer, initialState);
    const latest = useRef(state);

    useEffect(()=>{
        latest.current = state;
    });

    const load = useCallback(async (signal)=>{
        try{
            const { versions, hasMore } = await getVersions(workspaceId, documentId, { limit: pageSize }, signal);
            dispatch({ type: "loaded", versions, hasMore });

            // the newest version is shown first, so the dialog is never empty for no reason
            if(versions.length > 0) dispatch({ type: "select", versionId: versions[0].id });
        }
        catch(err){
            if(err.name !== "AbortError") dispatch({ type: "problem", message: `Could not load the history : ${err.message}` });
        }
    }, [workspaceId, documentId]);

    // read when the dialog opens, and again every time it is opened (somebody may have edited meanwhile)
    useEffect(()=>{
        if(!open) return;

        const controller = new AbortController();
        load(controller.signal);

        return ()=> controller.abort();
    }, [open, load]);

    // the text of the selected version
    useEffect(()=>{
        const versionId = state.selectedId;
        if(!open || !versionId || state.preview?.id === versionId) return;

        const controller = new AbortController();

        (async ()=>{
            try{
                const { content } = await getVersion(workspaceId, documentId, versionId, controller.signal);
                dispatch({ type: "preview", versionId, content });
            }
            catch(err){
                if(err.name !== "AbortError") dispatch({ type: "problem", message: `Could not open that version : ${err.message}` });
            }
        })();

        return ()=> controller.abort();
    }, [open, state.selectedId, state.preview?.id, workspaceId, documentId]);

    const select = useCallback((versionId)=> dispatch({ type: "select", versionId }), []);

    const loadMore = useCallback(async ()=>{
        const oldest = latest.current.versions.at(-1);
        if(!oldest) return;

        try{
            const { versions, hasMore } = await getVersions(workspaceId, documentId, { limit: pageSize, before: oldest.id });
            dispatch({ type: "more", versions, hasMore });
        }
        catch(err){
            dispatch({ type: "problem", message: `Could not load more : ${err.message}` });
        }
    }, [workspaceId, documentId]);

    // Puts the selected version back. The editor does not have to be told : the server sends the change to everybody
    // who has the document open, this tab included. The list is read again, because the restore added a version.
    const restore = useCallback(async (versionId)=>{
        dispatch({ type: "restoring", restoring: true });

        try{
            await restoreVersion(workspaceId, documentId, versionId);
            await load();
            dispatch({ type: "restoring", restoring: false });
            return true;
        }
        catch(err){
            dispatch({ type: "problem", message: `Could not restore that version : ${err.message}` });
            return false;
        }
    }, [workspaceId, documentId, load]);

    return { ...state, select, loadMore, restore };
}
