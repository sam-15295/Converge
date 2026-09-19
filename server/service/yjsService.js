import * as Y from "yjs";
import {getSchema} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {prosemirrorJSONToYDoc, yDocToProsemirrorJSON} from "@tiptap/y-tiptap";

// Helpers to move between the two forms of a document :
//   * the Yjs document (what is edited live and stored as the source of truth), and
//   * the ProseMirror JSON tree (a readable snapshot, used by the rich-text whitelist, and later by
//     version history and search).
//
// The editor stores its text in ONE named part of the Yjs document. The name must be the same
// on the server and in the browser (TipTap's Collaboration extension uses "default").
export const fragmentName = "default";

// The ProseMirror schema of our editor. It is only needed here to turn an old JSON document into a Yjs one.
const schema = getSchema([StarterKit]);

export const emptyContent = ()=> ({type : "doc", content : [{type : "paragraph"}]});

// A brand new Yjs document from a JSON tree (used once for documents written before Phase 5)
export const jsonToYDoc = (json)=>{
    return prosemirrorJSONToYDoc(schema, json, fragmentName);
}

// The JSON snapshot of a Yjs document. A Yjs document nobody has typed in yet has no paragraph at all,
// but the editor's schema needs at least one block, so an empty document is stored as one empty paragraph.
export const yDocToJSON = (ydoc)=>{
    const json = yDocToProsemirrorJSON(ydoc, fragmentName);

    if(!json.content || json.content.length === 0){
        return emptyContent();
    }

    return json;
}

// The whole state of a Yjs document as one update (this is what gets stored in MongoDB)
export const encodeState = (ydoc)=> Y.encodeStateAsUpdate(ydoc);
