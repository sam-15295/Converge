import { createContext, useContext } from "react";

// The context object plus the hook components use to read it.
// The provider that fills it in lives in DocumentCommentsProvider.jsx. It holds everything the comments of the open document
// need (see useDocumentComments) and also :
//   open            is the panel shown?           toggle()   show or hide it
//   members         the people who can be mentioned, [{ userId, name }]
//   currentUserId   who is logged in
//   permissions     what the user's role may do (from the page's own request)
export const CommentsContext = createContext(null);

export const useCommentsContext = ()=>{
    const value = useContext(CommentsContext);
    if(!value) throw new Error("useCommentsContext must be used inside <DocumentCommentsProvider>");
    return value;
}
