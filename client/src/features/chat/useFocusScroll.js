import { useEffect } from "react";

// Moves a list to what a link pointed at : the highlighted message is scrolled to the middle of the list. With no message
// (id null) the list goes to its newest end, which is what "Jump to latest" wants.
// focus is { id, token } from the chat state. The token is different every time, so the SAME message works twice
// (following one link again after scrolling away).
export const useFocusScroll = (listRef, focus)=>{
    const id = focus?.id;
    const token = focus?.token;

    // a passive effect : it runs after the layout effect of useMessageScroll, so the position chosen here wins
    useEffect(()=>{
        if(token === undefined) return;
        const list = listRef.current;
        if(!list) return;

        if(id){
            const element = document.getElementById(`message-${id}`);
            if(!element) return;

            // Only THIS list is scrolled. (element.scrollIntoView would also scroll the whole page, and the header would
            // slide out of view.)
            const distanceFromTop = element.getBoundingClientRect().top - list.getBoundingClientRect().top;
            list.scrollTop += distanceFromTop - (list.clientHeight - element.offsetHeight) / 2;
        } else {
            list.scrollTop = list.scrollHeight;
        }
    }, [id, token, listRef]);
}
