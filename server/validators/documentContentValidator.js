// XSS defence for rich text.
//
// The editor (TipTap / ProseMirror) sends a document as a JSON tree. Everything saved here is later shown
// to every collaborator, so the server never trusts what the browser sends : it checks the whole tree
// against a whitelist and refuses anything it does not know. The whitelist is exactly the TipTap StarterKit
// schema (read from the real schema, not guessed), so every document the editor really produces is accepted.
//
// What is refused : unknown node types (script, iframe, image...), unknown marks, unknown attributes,
// wrong children (a listItem directly in a paragraph), links that are not http / https / mailto
// (javascript:, data:, vbscript: ...), too deep trees, too many nodes, and any extra key on a node.
//
// findContentProblem(doc) returns null when the content is fine, or a short text saying what is wrong.

const maxDepth = 20;
const maxNodes = 20000;
export const maxTextLength = 100000;

const blockNodes = ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "codeBlock", "horizontalRule"];
const inlineNodes = ["text", "hardBreak"];

// for every node : which children it may have, how many it needs at least, and which attributes it may carry
export const nodeRules = {
    doc : {children : blockNodes, min : 1, attrs : {}},
    paragraph : {children : inlineNodes, min : 0, attrs : {}},
    heading : {children : inlineNodes, min : 0, attrs : {level : (v)=> Number.isInteger(v) && v >= 1 && v <= 6}},
    blockquote : {children : blockNodes, min : 1, attrs : {}},
    bulletList : {children : ["listItem"], min : 1, attrs : {}},
    orderedList : {
        children : ["listItem"],
        min : 1,
        attrs : {
            start : (v)=> Number.isInteger(v) && v >= 1 && v <= 100000,
            type : (v)=> v === null || (typeof v === "string" && v.length <= 5)
        }
    },
    listItem : {children : blockNodes, min : 1, attrs : {}},
    codeBlock : {children : ["text"], min : 0, attrs : {language : (v)=> v === null || (typeof v === "string" && v.length <= 30)}},
    horizontalRule : {children : [], min : 0, attrs : {}},
    hardBreak : {children : [], min : 0, attrs : {}}
};

const allowedLinkProtocols = ["http:", "https:", "mailto:"];

export const isSafeLink = (href)=>{
    if(typeof href !== "string" || href.length === 0 || href.length > 2000){
        return false;
    }

    try{
        // new URL understands tricks like " JaVa\nScRiPt:..." the same way a browser does
        return allowedLinkProtocols.includes(new URL(href).protocol);
    }
    catch(err){
        return false;   // not an absolute URL
    }
}

export const markRules = {
    bold : {},
    italic : {},
    strike : {},
    code : {},
    underline : {},
    link : {
        href : isSafeLink,
        target : (v)=> v === null || v === "_blank",
        rel : (v)=> v === null || (typeof v === "string" && v.length <= 100),
        class : (v)=> v === null,
        title : (v)=> v === null || (typeof v === "string" && v.length <= 200)
    }
};

// attributes a mark cannot do without (a link without an href is meaningless)
export const requiredMarkAttrs = {
    link : ["href"]
};

const isPlainObject = (value)=> typeof value === "object" && value !== null && !Array.isArray(value);

// checks an "attrs" object against the allowed attributes and their value rules
const attrsProblem = (attrs, rules, where)=>{
    if(attrs === undefined){
        return null;
    }
    if(!isPlainObject(attrs)){
        return `${where}: attrs must be an object`;
    }

    for(const [key, value] of Object.entries(attrs)){
        if(!Object.hasOwn(rules, key)){
            return `${where}: attribute "${key}" is not allowed`;
        }
        if(!rules[key](value)){
            return `${where}: attribute "${key}" has an invalid value`;
        }
    }
    return null;
}

const marksProblem = (marks, where)=>{
    if(marks === undefined){
        return null;
    }
    if(!Array.isArray(marks) || marks.length > 10){
        return `${where}: marks must be a short list`;
    }

    for(const mark of marks){
        if(!isPlainObject(mark) || !Object.hasOwn(markRules, mark.type)){
            return `${where}: mark "${mark?.type}" is not allowed`;
        }

        const extraKeys = Object.keys(mark).filter((key)=> key !== "type" && key !== "attrs");
        if(extraKeys.length > 0){
            return `${where}: mark has unexpected key "${extraKeys[0]}"`;
        }

        const problem = attrsProblem(mark.attrs, markRules[mark.type], `${where} mark "${mark.type}"`);
        if(problem){
            return problem;
        }

        for(const required of requiredMarkAttrs[mark.type] ?? []){
            if(mark.attrs?.[required] === undefined){
                return `${where} mark "${mark.type}": attribute "${required}" is required`;
            }
        }
    }
    return null;
}

export const findContentProblem = (doc)=>{
    if(!isPlainObject(doc) || doc.type !== "doc"){
        return "Document content must be an object of type doc";
    }

    let nodeCount = 0;

    // returns a problem text, or null. `allowedTypes` is what the parent accepts here.
    const check = (node, allowedTypes, depth, where)=>{
        nodeCount++;
        if(nodeCount > maxNodes){
            return "Document is too large";
        }
        if(depth > maxDepth){
            return "Document is nested too deeply";
        }
        if(!isPlainObject(node) || typeof node.type !== "string"){
            return `${where}: not a valid node`;
        }
        if(!allowedTypes.includes(node.type)){
            return `${where}: "${node.type}" is not allowed here`;
        }

        // ----- text -----
        if(node.type === "text"){
            const extraKeys = Object.keys(node).filter((key)=> !["type", "text", "marks"].includes(key));
            if(extraKeys.length > 0){
                return `${where}: text has unexpected key "${extraKeys[0]}"`;
            }
            if(typeof node.text !== "string" || node.text.length === 0 || node.text.length > maxTextLength){
                return `${where}: text must be a non-empty string`;
            }
            return marksProblem(node.marks, where);
        }

        // ----- every other node -----
        const rule = nodeRules[node.type];
        const extraKeys = Object.keys(node).filter((key)=> !["type", "attrs", "content"].includes(key));
        if(extraKeys.length > 0){
            return `${where}: "${node.type}" has unexpected key "${extraKeys[0]}"`;
        }

        const attrs = attrsProblem(node.attrs, rule.attrs, `${where} "${node.type}"`);
        if(attrs){
            return attrs;
        }

        const children = node.content ?? [];
        if(!Array.isArray(children)){
            return `${where}: content must be a list`;
        }
        if(children.length < rule.min){
            return `${where}: "${node.type}" needs at least ${rule.min} child`;
        }
        // a list item always starts with a paragraph (the ProseMirror schema says so)
        if(node.type === "listItem" && children[0]?.type !== "paragraph"){
            return `${where}: a list item must start with a paragraph`;
        }

        for(let i = 0; i < children.length; i++){
            const problem = check(children[i], rule.children, depth + 1, `${where}.content[${i}]`);
            if(problem){
                return problem;
            }
        }
        return null;
    }

    return check(doc, ["doc"], 0, "content");
}
