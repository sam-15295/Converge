import WorkspaceMember from "../model/workspaceMemberSchema.js";

// "@Rahul" in a text counts as a mention of Rahul only when
//   - the @ is not stuck to a word before it ("mail@Rahul" is an email address, not a mention), and
//   - the name is not followed by more letters or digits ("@Rahulx" is somebody else).
// The name is matched as plain text (special characters escaped), so a name like "A.B (x)" cannot change what the pattern means.
const escapeRegExp = (text)=> text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const containsMention = (content, name)=>{
    return new RegExp(`(?<![\\p{L}\\p{N}_])@${escapeRegExp(name)}(?![\\p{L}\\p{N}_])`, "u").test(content);
}

// Turns the mentions a client sent ([{userId}]) into what is stored ([{userId, displayName}]), or says what is wrong.
// The client is trusted with nothing here except WHICH people it means :
//   - every person must be a member of THIS workspace
//   - the name comes from our own data, so it cannot be forged
//   - the text must really contain @Name, so nobody can be mentioned invisibly
// Returns {mentions} or {problem}. Comments (a later phase) use the same function.
export const resolveMentions = async (workspaceId, content, requested)=>{
    // the same person twice is one mention (ids are already checked to be 24 hex characters, lower case makes them comparable)
    const ids = [...new Set((requested ?? []).map((mention)=> mention.userId.toLowerCase()))];

    if(ids.length === 0){
        return {mentions : []};
    }

    // one question for everybody : who of these is a member of this workspace, and what are they called?
    const memberships = await WorkspaceMember.find({workspaceId, userId : {$in : ids}}).populate("userId", "name");
    const nameOf = new Map(memberships.filter((membership)=> membership.userId).map((membership)=> [String(membership.userId._id), membership.userId.name]));

    const mentions = [];

    for(const id of ids){
        const name = nameOf.get(id);

        if(!name){
            return {problem : "You can only mention people who are members of this workspace"};
        }
        if(!containsMention(content, name)){
            return {problem : `The message must contain @${name} to mention them`};
        }
        mentions.push({userId : id, displayName : name});
    }

    return {mentions};
}
