import { useState } from "react";
import NotificationItem from "../features/notifications/NotificationItem";
import { useNotifications } from "../features/notifications/NotificationsContext";
import { useNotificationList } from "../features/notifications/useNotificationList";
import { useOpenNotification } from "../features/notifications/useOpenNotification";

// The list itself. It is a separate component so that a different filter (`key`) starts from a clean list.
const NotificationList = ({ onlyUnread })=>{
    const list = useNotificationList({ onlyUnread, limit: 20 });
    const open = useOpenNotification();
    const [loadingMore, setLoadingMore] = useState(false);

    const showMore = async ()=>{
        setLoadingMore(true);
        await list.loadMore();
        setLoadingMore(false);
    }

    return (
        <div>
            {list.problem && (
                <p role="alert" className="mb-3 rounded-md border border-danger-line bg-danger-bg px-3 py-2 text-sm text-danger">
                    {list.problem}
                </p>
            )}
            {!list.problem && !list.loaded && <p className="py-8 text-center text-sm text-muted">Loading…</p>}
            {list.loaded && list.items.length === 0 && (
                <p className="py-8 text-center text-sm text-muted">
                    {onlyUnread ? "No unread mentions." : "No mentions yet. When somebody mentions you, it shows up here."}
                </p>
            )}

            <ul aria-label="Mentions" className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-sm empty:hidden">
                {list.items.map((notification)=> (
                    <NotificationItem key={notification.id} notification={notification} onOpen={open} />
                ))}
            </ul>

            {list.hasMore && (
                <div className="mt-4 text-center">
                    <button
                        type="button"
                        disabled={loadingMore}
                        onClick={showMore}
                        className="rounded-md border border-line-strong px-4 py-1.5 text-sm text-body hover:bg-raised disabled:opacity-50"
                    >
                        {loadingMore ? "Loading…" : "Load more"}
                    </button>
                </div>
            )}
        </div>
    );
}

// The mentions inbox : everything where somebody mentioned the user, in all their workspaces.
const NotificationsPage = ()=>{
    const { unreadCount, markAllRead } = useNotifications();
    const [onlyUnread, setOnlyUnread] = useState(false);
    const [error, setError] = useState(null);

    const handleMarkAll = async ()=>{
        setError(null);
        try{
            await markAllRead();
        }
        catch(err){
            setError(err.message);
        }
    }

    const filterButton = (label, value)=> (
        <button
            type="button"
            aria-pressed={onlyUnread === value}
            onClick={()=> setOnlyUnread(value)}
            className={`rounded-md px-3 py-1 text-sm ${
                onlyUnread === value ? "bg-primary text-white" : "text-body hover:bg-raised"
            }`}
        >
            {label}
        </button>
    );

    return (
        <main className="mx-auto min-h-[calc(100dvh-3rem)] max-w-2xl px-4 py-8">
            <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-strong">Mentions</h1>
                    <p className="text-sm text-body">
                        {unreadCount === 0 ? "You are all caught up." : `${unreadCount} unread`}
                    </p>
                </div>
                <button
                    type="button"
                    disabled={unreadCount === 0}
                    onClick={handleMarkAll}
                    className="rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-body hover:bg-raised disabled:opacity-50"
                >
                    Mark all as read
                </button>
            </header>

            {error && (
                <p role="alert" className="mb-3 text-sm text-danger">
                    {error}
                </p>
            )}

            <div role="group" aria-label="Filter" className="mb-3 flex gap-1">
                {filterButton("All", false)}
                {filterButton("Unread", true)}
            </div>

            <NotificationList key={String(onlyUnread)} onlyUnread={onlyUnread} />
        </main>
    );
}

export default NotificationsPage;
