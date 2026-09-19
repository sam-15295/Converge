import { useEffect } from "react";

// Moves a list to what a link pointed at : the highlighted item is scrolled to the middle of the list. With no item
// (id null) the list goes to its newest end, which is what "Jump to latest" wants.
// focus is { id, token }. The token is different every time, so the SAME item works twice (following one link again
// after scrolling away). The items have the id `${idPrefix}-${id}` in the page ("message" in the chat, "comment" in comments).
export const useFocusScroll = (listRef, focus, idPrefix = "message")=>{
    const id = focus?.id;
    const token = focus?.token;

    // a passive effect : it runs after the layout effect of useMessageScroll, so the position chosen here wins
    useEffect(()=>{
        if(token === undefined) return;
        const list = listRef.current;
        if(!list) return;

        if(id){
            const element = document.getElementById(`${idPrefix}-${id}`);
            if(!element) return;

            // Only THIS list is scrolled. (element.scrollIntoView would also scroll the whole page, and the header would
            // slide out of view.)
            const distanceFromTop = element.getBoundingClientRect().top - list.getBoundingClientRect().top;
            list.scrollTop += distanceFromTop - (list.clientHeight - element.offsetHeight) / 2;
        } else {
            list.scrollTop = list.scrollHeight;
        }
    }, [id, token, listRef, idPrefix]);
}
