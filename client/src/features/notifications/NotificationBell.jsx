import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import NotificationItem from "./NotificationItem";
import { useNotificationList } from "./useNotificationList";
import { useNotifications } from "./NotificationsContext";
import { useOpenNotification } from "./useOpenNotification";

const BellIcon = ()=>{
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" strokeLinejoin="round" />
            <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
        </svg>
    );
}

// The dropdown itself. It only exists while the bell is open, so its list is read when it opens (and then kept up to date live).
const NotificationPanel = ({ id, onClose })=>{
    const { unreadCount, markAllRead } = useNotifications();
    const list = useNotificationList({ limit: 8 });
    const open = useOpenNotification(onClose);

    return (
        <div
            id={id}
            role="region"
            aria-label="Notifications"
            className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface shadow-lg"
        >
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <h2 className="text-sm font-semibold text-strong">Notifications</h2>
                <button
                    type="button"
                    disabled={unreadCount === 0}
                    onClick={()=> markAllRead().catch(()=>{})}
                    className="text-xs font-medium text-info hover:underline disabled:cursor-default disabled:text-faint disabled:no-underline"
                >
                    Mark all as read
                </button>
            </div>

            {list.problem && (
                <p role="alert" className="px-3 py-3 text-sm text-danger">
                    {list.problem}
                </p>
            )}
            {!list.problem && !list.loaded && <p className="px-3 py-4 text-center text-sm text-muted">Loading…</p>}
            {list.loaded && list.items.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted">Nothing yet. Mentions of you show up here.</p>
            )}

            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                {list.items.map((notification)=> (
                    <NotificationItem key={notification.id} notification={notification} onOpen={open} compact />
                ))}
            </ul>

            <div className="border-t border-line px-3 py-2 text-center">
                <Link to="/notifications" onClick={onClose} className="text-sm font-medium text-info hover:underline">
                    See all mentions
                </Link>
            </div>
        </div>
    );
}

// The bell in the top bar : a number for what is unread, and a dropdown with the latest notifications.
const NotificationBell = ()=>{
    const { unreadCount } = useNotifications();
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const panelId = useId();

    // a click anywhere else, or Escape, closes the dropdown
    useEffect(()=>{
        if(!open) return;

        const closeOnOutsideClick = (event)=>{
            if(!rootRef.current?.contains(event.target)) setOpen(false);
        };
        const closeOnEscape = (event)=>{
            if(event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", closeOnOutsideClick);
        document.addEventListener("keydown", closeOnEscape);
        return ()=>{
            document.removeEventListener("mousedown", closeOnOutsideClick);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                aria-label={`Notifications, ${unreadCount} unread`}
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={()=> setOpen((isOpen)=> !isOpen)}
                className="relative rounded-md p-2 text-body hover:bg-raised"
            >
                <BellIcon />
                {unreadCount > 0 && (
                    <span
                        aria-hidden="true"
                        className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-danger-solid px-1 text-center text-[10px] leading-4 font-semibold text-white"
                    >
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* read out by screen readers whenever the number changes */}
            <span role="status" className="sr-only">
                {unreadCount === 0 ? "No unread notifications" : `${unreadCount} unread notifications`}
            </span>

            {open && <NotificationPanel id={panelId} onClose={()=> setOpen(false)} />}
        </div>
    );
}

export default NotificationBell;
