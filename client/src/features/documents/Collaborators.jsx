import { useEffect, useState } from "react";

// Who else has this document open right now. Presence comes from the Yjs "awareness": temporary, never saved.
// The server decides each person's name and colour, so it cannot be faked.
const readPeople = (awareness)=>{
    const people = new Map();
    for(const [clientId, state] of awareness.getStates()){
        if(clientId !== awareness.clientID && state.user?.id) people.set(state.user.id, state.user); // one entry per person
    }
    return [...people.values()];
}

const Collaborators = ({ awareness })=>{
    const [people, setPeople] = useState(()=> readPeople(awareness));

    useEffect(()=>{
        const update = ()=> setPeople(readPeople(awareness));
        awareness.on("change", update);
        return ()=> awareness.off("change", update);
    }, [awareness]);

    if(people.length === 0) return <p className="text-sm text-muted">Only you are here right now.</p>;

    return (
        <ul aria-label="People in this document" className="flex flex-wrap items-center gap-2">
            {people.map((person)=> (
                <li
                    key={person.id}
                    title={person.name}
                    className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pr-2.5 pl-0.5 text-sm text-body"
                >
                    <span
                        aria-hidden="true"
                        style={{ backgroundColor: person.color }}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white"
                    >
                        {person.name.slice(0, 1).toUpperCase()}
                    </span>
                    {person.name}
                </li>
            ))}
        </ul>
    );
}

export default Collaborators;
