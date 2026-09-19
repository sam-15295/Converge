import appEvents from "./appEvents.js";
import {recordActivity} from "../service/activityService.js";

// Turns things that happened into lines of the workspace activity feed.
//
//     document:created                        ->  Amit created "Graphs"
//     version:created (AUTOSAVE)              ->  Priya edited "DP Notes"
//     version:created (RESTORE)               ->  Priya restored an older version of "DP Notes"
//     comment:created (a new thread)          ->  Rahul commented on "Trees"
//     mention:created                         ->  Amit mentioned Priya
//     member:joined                           ->  Aditya joined the workspace
//
// This is CLAUDE.md section 18's chain : the controllers say WHAT happened and know nothing about the feed.
//
// The important choice is WHICH events are worth a line. Typing is not one of them : a document counts as "edited"
// when its editing session produced a version, which happens at most once every few minutes. So a long afternoon of
// writing is one line, not thousands. Replies are not their own line either, only the start of a thread.
//
// Everything here runs after the answer was sent and catches its own errors, so a problem with the feed can never
// make somebody's edit or comment fail.
// Returns a function that removes the listeners again (used by tests, so they are never added twice).
export const attachActivityListeners = ()=>{
    const safely = (handler)=> async (event)=>{
        try{
            await handler(event);
        }
        catch(err){
            console.log(err);
        }
    }

    const onDocumentCreated = safely(({workspaceId, documentId, createdBy})=>
        recordActivity({workspaceId, actorId : createdBy, type : "DOCUMENT_CREATED", documentId}));

    // One version = one editing session that ended, which is exactly what "edited" should mean in a feed.
    // Several people may have edited in that session, so the last one to type is named as the actor.
    const onVersionCreated = safely(({workspaceId, documentId, authorIds, reason})=>{
        const actorId = authorIds?.at(-1);

        if(!actorId){
            return;
        }
        return recordActivity({
            workspaceId,
            actorId,
            type : reason === "RESTORE" ? "DOCUMENT_RESTORED" : "DOCUMENT_EDITED",
            documentId
        });
    });

    // only the start of a thread : a feed full of "replied" lines would say nothing
    const onCommentCreated = safely(({workspaceId, documentId, comment})=>{
        if(comment.parentCommentId){
            return;
        }
        return recordActivity({workspaceId, actorId : comment.author.id, type : "COMMENT_ADDED", documentId});
    });

    const onMention = safely(({workspaceId, recipientId, senderId})=>{
        // mentioning yourself is not news
        if(String(recipientId) === String(senderId)){
            return;
        }
        return recordActivity({workspaceId, actorId : senderId, type : "MENTIONED", subjectId : recipientId});
    });

    const onMemberJoined = safely(({workspaceId, userId})=>
        recordActivity({workspaceId, actorId : userId, type : "MEMBER_JOINED"}));

    appEvents.on("document:created", onDocumentCreated);
    appEvents.on("version:created", onVersionCreated);
    appEvents.on("comment:created", onCommentCreated);
    appEvents.on("mention:created", onMention);
    appEvents.on("member:joined", onMemberJoined);

    return ()=>{
        appEvents.off("document:created", onDocumentCreated);
        appEvents.off("version:created", onVersionCreated);
        appEvents.off("comment:created", onCommentCreated);
        appEvents.off("mention:created", onMention);
        appEvents.off("member:joined", onMemberJoined);
    };
}
