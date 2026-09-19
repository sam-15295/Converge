// "/path" + { limit: 20, before: "abc", unread: undefined }  ->  "/path?limit=20&before=abc"  (empty values are left out)
export const withQuery = (path, params)=>{
    const query = new URLSearchParams();

    for(const [key, value] of Object.entries(params ?? {})){
        if(value !== undefined && value !== null) query.set(key, value);
    }
    const text = query.toString();
    return text ? `${path}?${text}` : path;
}
