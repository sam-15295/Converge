import { Navigate, Outlet, useLocation } from "react-router-dom";
import FullPageMessage from "../../components/FullPageMessage";
import { useAuth } from "./AuthContext";

// Login/signup pages make no sense for someone already logged in, so send them onward.
// This also performs the redirect right after a successful login or registration.
const PublicOnlyRoute = ()=>{
    const { status } = useAuth();
    const location = useLocation();

    if(status === "loading") return <FullPageMessage>Loading…</FullPageMessage>;
    if(status === "authenticated") return <Navigate to={location.state?.from?.pathname ?? "/"} replace />;
    return <Outlet />;
}

export default PublicOnlyRoute;
