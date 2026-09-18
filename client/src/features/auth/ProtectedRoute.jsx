import { Navigate, Outlet, useLocation } from "react-router-dom";
import FullPageMessage from "../../components/FullPageMessage";
import { useAuth } from "./AuthContext";

// Wraps pages that need a login. Convenience only: the REAL protection is the backend,
// which rejects unauthenticated API calls no matter what the frontend shows.
const ProtectedRoute = ()=>{
    const { status } = useAuth();
    const location = useLocation();

    if(status === "loading") return <FullPageMessage>Loading…</FullPageMessage>;
    if(status === "unauthenticated"){
        // Remember where the user was heading so login can send them back there.
        return <Navigate to="/login" replace state={{ from: location }} />;
    }
    return <Outlet />;
}

export default ProtectedRoute;
