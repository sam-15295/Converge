import { BrowserRouter, Route, Routes } from "react-router-dom";
import AuthProvider from "./features/auth/AuthProvider";
import ProtectedRoute from "./features/auth/ProtectedRoute";
import PublicOnlyRoute from "./features/auth/PublicOnlyRoute";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import SignupPage from "./pages/SignupPage";
import StatusPage from "./pages/StatusPage";

const App = ()=>{
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* Only for logged-out visitors */}
                    <Route element={<PublicOnlyRoute />}>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                    </Route>

                    {/* Only for logged-in users */}
                    <Route element={<ProtectedRoute />}>
                        <Route path="/" element={<DashboardPage />} />
                    </Route>

                    {/* Anyone */}
                    <Route path="/status" element={<StatusPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
