import {EventEmitter} from "node:events";

// A tiny in-process event bus. A controller says WHAT happened, and whoever cares reacts,
// so the controller does not have to know about sockets (or, later, notifications and the activity feed).
//
//     appEvents.emit("membership:changed", {workspaceId, userId});
//
// Events used now :
//     membership:changed   a member was removed, left, or got another role      {workspaceId, userId}
//     workspace:deleted    a workspace was deleted                              {workspaceId}
//     document:deleted     a document was deleted                               {workspaceId, documentId}
//
// It only works inside ONE server process. With several instances (Phase 11) the events would travel through Redis.
const appEvents = new EventEmitter();

export default appEvents;
