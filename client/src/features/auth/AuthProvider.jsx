import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./AuthContext";
import * as authApi from "./authApi";

// Holds "who is logged in" for the whole app.
// status: 'loading' (still asking the server) | 'authenticated' | 'unauthenticated'
//
// The JWT lives in an HTTP-only cookie that JavaScript cannot read, so the client can never
// know it is logged in by looking at the cookie. It has to ask the server (GET /user/profile).
// That request on page load is how a session survives a refresh.
const AuthProvider = ({ children })=>{
    const [state, setState] = useState({ status: "loading", user: null });

    useEffect(()=>{
        const controller = new AbortController();

        authApi
            .fetchProfile(controller.signal)
            .then((user)=> setState({ status: "authenticated", user }))
            .catch((err)=>{
                // A 401 here is normal ("not logged in"), not an error to display.
                if(err.name !== "AbortError") setState({ status: "unauthenticated", user: null });
            });

        return ()=> controller.abort();
    }, []);

    const signIn = useCallback(async (apiCall, fields)=>{
        const user = await apiCall(fields);
        setState({ status: "authenticated", user });
    }, []);

    const value = useMemo(
        ()=> ({
            status: state.status,
            user: state.user,
            login: (fields)=> signIn(authApi.login, fields),
            signup: (fields)=> signIn(authApi.signup, fields),
            logout: async ()=>{
                await authApi.logout();
                setState({ status: "unauthenticated", user: null });
            },
            updateProfile: async (fields)=>{
                const user = await authApi.updateProfile(fields);
                setState((prev)=> ({ ...prev, user }));
            }
        }),
        [state, signIn]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
