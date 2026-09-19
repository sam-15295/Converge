import * as Y from "yjs";
import {nodeRules, markRules, requiredMarkAttrs, maxTextLength} from "./documentContentValidator.js";

// XSS defence for LIVE editing.
//
// In Phase 4 the server checked the whole JSON document on every save. Now the editor sends Yjs UPDATES:
// small binary messages such as "insert this text here" or "start a bold mark here". The server cannot
// read them as text, but it can decode them (Y.decodeUpdate) and look at everything the update INSERTS.
// A hand-made update is checked against the same whitelist as before, so it cannot smuggle in
//   * a node type that is not in the editor's schema (script, iframe, ...),
//   * a mark that is not in the schema, or a link that is not http / https / mailto,
//   * an attribute that no node has (onclick ...) or an attribute with a wrong value,
//   * any other kind of Yjs data (maps, arrays, embedded objects, binary data, sub documents).
// It is checked BEFORE the update is applied or sent to anybody else.
//
// What this does not check is the nesting (a list item directly inside a paragraph). That can only mess up the
// layout of the shared document, never run a script, and the whole document is checked again with the JSON
// whitelist every time it is saved.
//
// findUpdateProblem(update) returns null when the update is fine, or a short text saying what is wrong.

// the kinds of content inside a Yjs update (Yjs calls them "refs")
const contentDeleted = 1;
const contentString = 4;
const contentFormat = 6;
const contentType = 7;
const contentAny = 8;

// attributes that a NODE may have, with the same value rules as in the JSON whitelist (heading level, list start ...)
const nodeAttributeRules = {};
for(const rule of Object.values(nodeRules)){
    Object.assign(nodeAttributeRules, rule.attrs);
}

// The Yjs key of a mark is its name, sometimes followed by "--" and a hash ("link--Ab1x") when a text can carry
// two versions of the same mark.
const markNameOf = (key)=> String(key).split("--")[0];

const isEmptyAttrs = (value)=> value === null || (typeof value === "object" && Object.keys(value).length === 0);

const markValueProblem = (markName, value)=>{
    if(markName !== "link"){
        return isEmptyAttrs(value) ? null : `mark "${markName}" cannot have attributes`;
    }

    // a link mark carries its attributes ; "null" is what Yjs writes to CLOSE the mark
    if(value === null){
        return null;
    }
    if(typeof value !== "object" || Array.isArray(value)){
        return `mark "link" has an invalid value`;
    }

    for(const [key, attribute] of Object.entries(value)){
        if(!Object.hasOwn(markRules.link, key)){
            return `link attribute "${key}" is not allowed`;
        }
        if(!markRules.link[key](attribute)){
            return `link attribute "${key}" has an invalid value`;
        }
    }
    for(const required of requiredMarkAttrs.link){
        if(value[required] === undefined){
            return `link attribute "${required}" is required`;
        }
    }
    return null;
}

export const findUpdateProblem = (update)=>{
    let structs;

    try{
        ({structs} = Y.decodeUpdate(update));
    }
    catch(err){
        return "The update is not a valid Yjs update";
    }

    for(const struct of structs){
        const content = struct.content;

        // GC and Skip entries carry no content, nothing to check
        if(!content || typeof content.getRef !== "function"){
            continue;
        }

        const kind = content.getRef();

        if(kind === contentDeleted){
            continue;
        }

        if(kind === contentString){
            if(content.str.length > maxTextLength){
                return "The update contains too much text";
            }
            continue;
        }

        if(kind === contentType){
            const type = content.type;

            // nodes are XmlElements (paragraph, heading ...), the text inside them is XmlText. Nothing else.
            if(type instanceof Y.XmlText && !(type instanceof Y.XmlElement)){
                continue;
            }
            if(type instanceof Y.XmlElement){
                if(!Object.hasOwn(nodeRules, type.nodeName) || type.nodeName === "doc"){
                    return `node type "${type.nodeName}" is not allowed`;
                }
                continue;
            }
            return "this kind of shared data is not allowed";
        }

        if(kind === contentFormat){
            const markName = markNameOf(content.key);

            if(!Object.hasOwn(markRules, markName)){
                return `mark "${markName}" is not allowed`;
            }

            const problem = markValueProblem(markName, content.value);
            if(problem){
                return problem;
            }
            continue;
        }

        if(kind === contentAny){
            // The only place plain values are allowed is an ATTRIBUTE of a node (heading level, list start ...).
            const attribute = struct.parentSub;

            if(typeof attribute !== "string" || !Object.hasOwn(nodeAttributeRules, attribute)){
                return `attribute "${attribute}" is not allowed`;
            }
            for(const value of content.arr){
                if(!nodeAttributeRules[attribute](value)){
                    return `attribute "${attribute}" has an invalid value`;
                }
            }
            continue;
        }

        // embeds, binary data, JSON content and sub documents are not part of the editor's schema
        return "this kind of content is not allowed";
    }

    return null;
}
