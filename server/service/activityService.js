import Activity from "../model/activitySchema.js";

// Writing, reading and cleaning up the workspace activity feed.
//
// Nothing here decides WHAT is worth recording : that is events/activityListeners.js. This file only stores and reads.

const people = "name";

const asIsoDate = (value)=> value ? new Date(value).toISOString() : null;

const asPerson = (user)=>{
    if(!user){
        return null;
    }
    return {id : String(user._id ?? user), name : user.name ?? null};
}

// What is sent to clients. The document is sent as {id, title} so the feed can link to it; a document that has been
// deleted since is simply not in the feed any more, so it cannot be null here.
export const formatActivity = (activity)=>{
    return {
        id : String(activity._id),
        type : activity.type,
        actor : asPerson(activity.actorId),
        document : activity.documentId ? {id : String(activity.documentId._id ?? activity.documentId), title : activity.documentId.title ?? null} : null,
        subject : asPerson(activity.subjectId),
        createdAt : asIsoDate(activity.createdAt)
    };
}

export const recordActivity = ({workspaceId, actorId, type, documentId = null, subjectId = null})=>{
    return Activity.create({workspaceId, actorId, type, documentId, subjectId});
}

// What happened in a workspace, newest first, read with a CURSOR like every other list in this project.
// Returns {activities, hasMore}, or null when the cursor is not an entry of this workspace.
export const findActivities = async ({workspaceId, before, limit})=>{
    const filter = {workspaceId};

    if(before){
        const cursor = await Activity.findOne({_id : before, workspaceId}).select("createdAt");

        if(!cursor){
            return null;
        }
        filter.$or = [
            {createdAt : {$lt : cursor.createdAt}},
            {createdAt : cursor.createdAt, _id : {$lt : cursor._id}}
        ];
    }

    // one extra tells whether there is more, without a second query
    const found = await Activity.find(filter)
    .populate("actorId", people)
    .populate("subjectId", people)
    .populate("documentId", "title")
    .sort({createdAt : -1, _id : -1})
    .limit(limit + 1);

    return {activities : found.slice(0, limit).map(formatActivity), hasMore : found.length > limit};
}

// the document was deleted : the feed must not keep pointing at something that is gone
export const removeActivitiesOfDocument = (documentId)=> Activity.deleteMany({documentId});
