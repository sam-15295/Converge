// Everything about @mentions that is not React : finding what the user is typing, choosing suggestions, and finding
// the mentions in a finished message. It follows the SAME rule as the server (server/service/mentionService.js) :
// "@Name" counts only when the @ is not glued to a word before it, and the name is not followed by more letters.

const escapeRegExp = (text)=> text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const notInWord = "(?<![\\p{L}\\p{N}_])";
const notMoreWord = "(?![\\p{L}\\p{N}_])";

export const containsMention = (text, name)=>{
    return new RegExp(`${notInWord}@${escapeRegExp(name)}${notMoreWord}`, "u").test(text);
}

// While typing : is the caret inside an "@something"? Returns {start, query} (start = where the @ is), or null.
// The @ must be at the start or after something that is not a letter or digit ("mail@x" is not a mention), and
// the query has no spaces : a space ends it.
export const findMentionQuery = (text, caret)=>{
    const before = text.slice(0, caret);
    const match = /(?:^|[^\p{L}\p{N}_])@([^\s@]*)$/u.exec(before);

    if(!match) return null;
    return { start: caret - match[1].length - 1, query: match[1] };
}

// The members to offer for what was typed after the @ : names that START with it first, then names that contain it
export const suggestMembers = (members, query, limit = 6)=>{
    const wanted = query.toLowerCase();
    const starting = [];
    const containing = [];

    for(const member of members){
        const name = member.name.toLowerCase();
        if(name.startsWith(wanted)) starting.push(member);
        else if(name.includes(wanted)) containing.push(member);
    }
    return [...starting, ...containing].slice(0, limit);
}

// Puts the chosen member into the text : "@Pri" becomes "@Priya ". Says where the caret goes afterwards.
export const insertMention = (text, start, caret, member)=>{
    const after = text.slice(caret);
    const space = /^\s/.test(after) ? "" : " "; // no second space when one is already there
    const inserted = `@${member.name}${space}`;

    return { text: text.slice(0, start) + inserted + after, caret: start + inserted.length };
}

// The people to send with the message : the ones that were picked AND whose "@Name" is still in the text.
// (If the user picked somebody and then edited or deleted the name, they are not mentioned any more.)
export const mentionsInText = (text, picked)=>{
    return picked.filter((member)=> containsMention(text, member.name)).map((member)=> ({ userId: member.userId }));
}

// A finished message cut into pieces, so mentions can be highlighted : [{ text }, { text, userIds }, { text }, ...]
// Only the mentions stored with the message count, so typing "@Priya" by hand does not light up. Longer names are tried
// first, so "@Alice" is never read as "@Al" + "ice".
export const splitByMentions = (content, mentions)=>{
    if(mentions.length === 0) return [{ text: content }];

    const names = [...new Set(mentions.map((mention)=> mention.displayName))].sort((a, b)=> b.length - a.length);
    const pattern = new RegExp(`${notInWord}@(${names.map(escapeRegExp).join("|")})${notMoreWord}`, "gu");

    const parts = [];
    let last = 0;

    for(const match of content.matchAll(pattern)){
        if(match.index > last) parts.push({ text: content.slice(last, match.index) });

        // two people may share a name : all of them belong to this piece
        const userIds = mentions.filter((mention)=> mention.displayName === match[1]).map((mention)=> mention.userId);
        parts.push({ text: match[0], userIds });
        last = match.index + match[0].length;
    }
    if(last < content.length) parts.push({ text: content.slice(last) });

    return parts;
}
