import appEvents from "./appEvents.js";
import {countUnread, createNotification, formatNotifications} from "../service/notificationService.js";

// Turns "somebody was mentioned" into a saved notification, and tells the rest of the app that there is a new one.
//
//     mention:created  ->  (this file saves it)  ->  notification:created  ->  the socket layer pushes it to the person
//
// The controller that saved the message knows nothing about this : it only said what happened. It runs after the
// answer was sent, so a problem here can never make sending a message fail (it is logged instead).
// Returns a function that removes the listener again (used by tests, so it is never added twice).
export const attachNotificationListeners = ()=>{
    const onMention = async ({workspaceId, recipientId, senderId, sourceType, sourceId})=>{
        try{
            // nobody needs to be notified about what they wrote themselves
            if(String(recipientId) === String(senderId)){
                return;
            }

            const notification = await createNotification({type : "MENTION", recipientId, senderId, workspaceId, sourceType, sourceId});

            // null : this person was already notified about this message
            if(!notification){
                return;
            }

            const [formatted] = await formatNotifications([notification]);

            appEvents.emit("notification:created", {
                recipientId : String(recipientId),
                notification : formatted,
                unreadCount : await countUnread(recipientId)
            });
        }
        catch(err){
            console.log(err);
        }
    }

    appEvents.on("mention:created", onMention);

    return ()=> appEvents.off("mention:created", onMention);
}
