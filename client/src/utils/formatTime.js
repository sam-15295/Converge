// "14:05" for something from today, "12 Sep, 14:05" for anything older
export const formatTime = (isoDate)=>{
    const date = new Date(isoDate);
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if(date.toDateString() === new Date().toDateString()) return time;
    return `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}
