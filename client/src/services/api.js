// The single place the frontend talks to the REST API.
// Every server response is JSON with a "message", plus extra fields :
//   success : { message, user }
//   failure : { message }   or   { message, errors : { email : "Email is not valid" } }
// apiRequest returns the JSON body on success and throws an ApiClientError otherwise.

export class ApiClientError extends Error {
    constructor(status, message, errors = {}, body = null) {
        super(message);
        this.name = "ApiClientError";
        this.status = status;
        this.errors = errors; // per-field messages (only for validation failures)
        this.body = body; // the whole JSON body, e.g. the health endpoint sends data even with a 503
    }
}

export const apiRequest = async (path, { method = "GET", body, signal } = {})=>{
    let response;
    try{
        response = await fetch(`/api${path}`, {
            method,
            credentials: "include", // send/receive the HTTP-only login cookie
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined,
            signal
        });
    }
    catch(err){
        if(err.name === "AbortError") throw err;
        throw new ApiClientError(0, "Cannot reach the server");
    }

    // A proxy error page or a crashed server may not return JSON.
    const payload = await response.json().catch(()=> null);

    if(!payload){
        throw new ApiClientError(response.status, "Server returned an invalid response");
    }
    if(!response.ok){
        throw new ApiClientError(response.status, payload.message, payload.errors, payload);
    }
    return payload;
}
