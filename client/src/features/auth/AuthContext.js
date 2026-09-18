import { createContext, useContext } from "react";

// The context object plus the hook components use to read it.
// The provider that fills it in lives in AuthProvider.jsx.
export const AuthContext = createContext(null);

export const useAuth = ()=>{
    const value = useContext(AuthContext);
    if(!value) throw new Error("useAuth must be used inside <AuthProvider>");
    return value;
}
