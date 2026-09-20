import { Link, Outlet } from "react-router-dom";
import NotificationBell from "../features/notifications/NotificationBell";
import NotificationsProvider from "../features/notifications/NotificationsProvider";

// The frame around every page of a logged in user : a slim top bar with the way home, the mentions inbox and the bell.
// The notifications provider lives here, so there is one live connection per tab and the bell works on every page.
// The bar is 3rem (h-12) high : pages that fill the screen use 100dvh - 3rem.
const AppLayout = ()=>{
    return (
        <NotificationsProvider>
            <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-line bg-surface px-4">
                <Link to="/" className="font-semibold text-strong">
                    Converge
                </Link>
                <nav aria-label="Main" className="flex items-center gap-1">
                    <Link to="/notifications" className="rounded-md px-3 py-1.5 text-sm text-body hover:bg-raised">
                        Mentions
                    </Link>
                    <NotificationBell />
                </nav>
            </header>
            <Outlet />
        </NotificationsProvider>
    );
}

export default AppLayout;
