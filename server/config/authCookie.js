import env from "./env.js";

// the name is not just "token", because cookies on localhost are shared between ports
// and another local project could overwrite it
export const authCookieName = "converge_token";

export const authCookieOptions = {
    httpOnly : true,                            // javascript in the page cannot read it, so XSS cannot steal the login
    secure : env.NODE_ENV === "production",     // production : only sent over https
    sameSite : "lax",                           // not sent with cross-site POST requests (CSRF protection)
    path : "/",
    maxAge : env.JWT_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
};
