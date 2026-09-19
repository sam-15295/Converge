import { formatTime, timeAgo } from "../../utils/formatTime";

// One line per version : when it was made, who edited, and whether it was a restore.
const names = (people)=>{
    const known = people.map((person)=> person.name).filter(Boolean);

    if(known.length === 0) return "Somebody";
    if(known.length <= 2) return known.join(" and ");
    return `${known[0]}, ${known[1]} and ${known.length - 2} more`;
}

const VersionList = ({ versions, selectedId, onSelect, hasMore, onLoadMore, loadingMore })=>{
    return (
        // h-full : the list must stay INSIDE the dialog and scroll by itself, or "Load more" ends up below the screen
        <div className="flex h-full min-h-0 flex-col">
            <ul aria-label="Versions" className="min-h-0 flex-1 overflow-y-auto">
                {versions.map((version)=>{
                    const selected = version.id === selectedId;
                    const restored = version.reason === "RESTORE";

                    return (
                        <li key={version.id}>
                            <button
                                type="button"
                                aria-current={selected}
                                onClick={()=> onSelect(version.id)}
                                className={`w-full border-l-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                                    selected ? "border-slate-900 bg-slate-50" : "border-transparent"
                                }`}
                            >
                                <span className="block font-medium text-slate-900">
                                    <time dateTime={version.createdAt} title={formatTime(version.createdAt)}>
                                        {timeAgo(version.createdAt)}
                                    </time>
                                </span>
                                <span className="mt-0.5 block text-slate-600">
                                    {restored ? `Restored by ${version.createdBy?.name ?? "somebody"}` : `Edited by ${names(version.authors)}`}
                                </span>
                                {restored && (
                                    <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                                        restored
                                    </span>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>

            {hasMore && (
                <div className="border-t border-slate-200 p-2 text-center">
                    <button
                        type="button"
                        disabled={loadingMore}
                        onClick={onLoadMore}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        {loadingMore ? "Loading…" : "Load more"}
                    </button>
                </div>
            )}
        </div>
    );
}

export default VersionList;
