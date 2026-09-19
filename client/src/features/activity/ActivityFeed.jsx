import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatTime, timeAgo } from "../../utils/formatTime";
import { getActivity } from "./activityApi";

const pageSize = 15;

// What each kind of line says. The pieces are kept apart so the document can be a link and the names stay plain text.
const sentence = (entry)=>{
    switch(entry.type){
        case "DOCUMENT_CREATED":
            return { verb: "created", document: true };
        case "DOCUMENT_EDITED":
            return { verb: "edited", document: true };
        case "DOCUMENT_RESTORED":
            return { verb: "restored an older version of", document: true };
        case "COMMENT_ADDED":
            return { verb: "commented on", document: true };
        case "MENTIONED":
            return { verb: "mentioned", subject: true };
        case "MEMBER_JOINED":
            return { verb: "joined the workspace" };
        default:
            return { verb: "did something" };
    }
}

// The recent history of a workspace : who did what, and when. It is read when the page opens and with "Load more";
// it is not live, because a feed is something you look at, not a conversation.
const ActivityFeed = ({ workspaceId })=>{
    const [state, setState] = useState({ activities: [], hasMore: false, loading: true, problem: null });
    const [loadingMore, setLoadingMore] = useState(false);
    const latest = useRef(state);

    useEffect(()=>{
        latest.current = state;
    });

    useEffect(()=>{
        const controller = new AbortController();

        getActivity(workspaceId, { limit: pageSize }, controller.signal)
        .then(({ activities, hasMore })=> setState({ activities, hasMore, loading: false, problem: null }))
        .catch((error)=>{
            if(error.name !== "AbortError") setState({ activities: [], hasMore: false, loading: false, problem: error.message });
        });

        return ()=> controller.abort();
    }, [workspaceId]);

    const loadMore = useCallback(async ()=>{
        const oldest = latest.current.activities.at(-1);
        if(!oldest) return;

        setLoadingMore(true);
        try{
            const { activities, hasMore } = await getActivity(workspaceId, { limit: pageSize, before: oldest.id });
            setState((current)=> ({ ...current, activities: [...current.activities, ...activities], hasMore }));
        }
        catch(error){
            setState((current)=> ({ ...current, problem: error.message }));
        }
        setLoadingMore(false);
    }, [workspaceId]);

    if(state.loading) return <p className="text-sm text-slate-500">Loading…</p>;

    if(state.problem){
        return (
            <p role="alert" className="text-sm text-red-600">
                Could not load the activity : {state.problem}
            </p>
        );
    }

    if(state.activities.length === 0){
        return <p className="text-sm text-slate-500">Nothing has happened here yet.</p>;
    }

    return (
        <div>
            <ul aria-label="Activity" className="divide-y divide-slate-100">
                {state.activities.map((entry)=>{
                    const { verb, document, subject } = sentence(entry);

                    return (
                        <li key={entry.id} className="py-2 text-sm text-slate-700">
                            <span className="font-medium text-slate-900">{entry.actor?.name ?? "Somebody"}</span> {verb}
                            {document && entry.document && (
                                <>
                                    {" "}
                                    <Link
                                        to={`/workspace/${workspaceId}/document/${entry.document.id}`}
                                        className="font-medium text-slate-900 underline"
                                    >
                                        {entry.document.title}
                                    </Link>
                                </>
                            )}
                            {subject && <> <span className="font-medium text-slate-900">{entry.subject?.name ?? "somebody"}</span></>}
                            {" · "}
                            <time dateTime={entry.createdAt} title={formatTime(entry.createdAt)} className="text-slate-500">
                                {timeAgo(entry.createdAt)}
                            </time>
                        </li>
                    );
                })}
            </ul>

            {state.hasMore && (
                <div className="mt-3 text-center">
                    <button
                        type="button"
                        disabled={loadingMore}
                        onClick={loadMore}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        {loadingMore ? "Loading…" : "Load more"}
                    </button>
                </div>
            )}
        </div>
    );
}

export default ActivityFeed;
