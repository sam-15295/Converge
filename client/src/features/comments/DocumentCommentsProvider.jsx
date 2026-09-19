import { useState } from "react";
import { CommentsContext } from "./CommentsContext";
import { useDocumentComments } from "./useDocumentComments";

// Holds the comments of the open document for the whole page : the button in the header and the panel next to the editor
// both read the same state (one live connection, one list).
//
// focus : { commentId, replyId, key } when the page was opened from a link. The panel then opens by itself, at that comment.
const DocumentCommentsProvider = ({ workspaceId, documentId, permissions, currentUserId, members, focus, children })=>{
    const comments = useDocumentComments(workspaceId, documentId, permissions.includes("comment:create"), focus);

    // The panel follows a link (open when the page has one), until the user opens or closes it themselves. The choice is
    // remembered together with the link it was made for, so a NEW link opens the panel again.
    const [choice, setChoice] = useState({ key: null, open: false });
    const linkKey = focus?.key ?? null;
    const open = choice.key === linkKey ? choice.open : Boolean(focus?.commentId);
    const toggle = ()=> setChoice({ key: linkKey, open: !open });

    const value = { ...comments, open, toggle, members, currentUserId, permissions };

    return <CommentsContext.Provider value={value}>{children}</CommentsContext.Provider>;
}

export default DocumentCommentsProvider;
