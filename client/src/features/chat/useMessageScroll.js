import { useLayoutEffect, useRef } from "react";

// Keeps a list of messages scrolled sensibly (used by the main chat and by a thread) :
//   - the first time messages appear : start at the newest
//   - a new message at the bottom : follow it if the reader is already at the bottom (or wrote it), otherwise do not
//     pull them away from what they are reading
//   - older messages added on top : keep the reader exactly where they were
// follow = false : the list shows a stretch of the past (opened from a link), so it never jumps to the newest end by
// itself, not even when newer messages are loaded below what the reader sees.
// Put listRef on the scrolling element and handleScroll on its onScroll.
export const useMessageScroll = (messages, userId, follow = true)=>{
    const listRef = useRef(null);
    const atBottom = useRef(true);
    const previous = useRef({ firstId: null, lastId: null, height: 0 });

    const handleScroll = ()=>{
        const list = listRef.current;
        atBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    };

    // a layout effect runs before the browser paints, so the reader never sees the list jump
    useLayoutEffect(()=>{
        const list = listRef.current;
        if(!list) return;

        const firstId = messages[0]?.id ?? null;
        const last = messages.at(-1);
        const lastId = last?.id ?? null;
        const before = previous.current;

        if(before.lastId === null){
            if(follow) list.scrollTop = list.scrollHeight;
        } else if(lastId !== before.lastId){
            if(follow && (atBottom.current || last?.sender.id === userId)) list.scrollTop = list.scrollHeight;
        } else if(firstId !== before.firstId){
            list.scrollTop += list.scrollHeight - before.height;
        }

        previous.current = { firstId, lastId, height: list.scrollHeight };
    }, [messages, userId, follow]);

    return { listRef, handleScroll };
}
