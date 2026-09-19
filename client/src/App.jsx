import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AuthProvider from "./features/auth/AuthProvider";
import ProtectedRoute from "./features/auth/ProtectedRoute";
import AppLayout from "./pages/AppLayout";
import PublicOnlyRoute from "./features/auth/PublicOnlyRoute";
import ChatPage from "./pages/ChatPage";
import DashboardPage from "./pages/DashboardPage";
import WorkspacePage from "./pages/WorkspacePage";
import LoginPage from "./pages/LoginPage";
import NotificationsPage from "./pages/NotificationsPage";
import FullPageMessage from "./components/FullPageMessage";
import NotFoundPage from "./pages/NotFoundPage";
import SignupPage from "./pages/SignupPage";
import StatusPage from "./pages/StatusPage";

// The editor (TipTap + ProseMirror) is large and only the document page needs it,
// so that page is downloaded when somebody opens a document, not on the first page load.
const DocumentPage = lazy(()=> import("./pages/DocumentPage"));

const App = ()=>{
    return (
        <BrowserRouter>
            <AuthProvider>
                <Suspense fallback={<FullPageMessage>Loading…</FullPageMessage>}>
                    <Routes>
                        {/* Only for logged-out visitors */}
                        <Route element={<PublicOnlyRoute />}>
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/signup" element={<SignupPage />} />
                        </Route>

                        {/* Only for logged-in users */}
                        <Route element={<ProtectedRoute />}>
                            {/* the top bar with the notification bell is around all of these */}
                            <Route element={<AppLayout />}>
                                <Route path="/" element={<DashboardPage />} />
                                <Route path="/notifications" element={<NotificationsPage />} />
                                <Route path="/workspace/:workspaceId" element={<WorkspacePage />} />
                                <Route path="/workspace/:workspaceId/chat" element={<ChatPage />} />
                                <Route path="/workspace/:workspaceId/document/:documentId" element={<DocumentPage />} />
                            </Route>
                        </Route>

                        {/* Anyone */}
                        <Route path="/status" element={<StatusPage />} />
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </Suspense>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
