import { apiRequest } from "../../services/api";

// One function per user endpoint. Each returns the user (or nothing); errors are thrown as ApiClientError.

export const fetchProfile = (signal)=> apiRequest("/user/profile", { signal }).then((data)=> data.user);

export const signup = (fields) =>
    apiRequest("/user/signup", { method: "POST", body: fields }).then((data)=> data.user);

export const login = (fields)=> apiRequest("/user/login", { method: "POST", body: fields }).then((data)=> data.user);

export const logout = ()=> apiRequest("/user/logout", { method: "POST" });

export const updateProfile = (fields) =>
    apiRequest("/user/profile", { method: "PATCH", body: fields }).then((data)=> data.user);
