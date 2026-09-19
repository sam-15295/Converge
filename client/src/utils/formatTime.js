// "14:05" for something from today, "12 Sep, 14:05" for anything older
export const formatTime = (isoDate)=>{
    const date = new Date(isoDate);
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if(date.toDateString() === new Date().toDateString()) return time;
    return `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

// "just now", "2 minutes ago", "3 hours ago", "yesterday", then the date : how long ago something happened
export const timeAgo = (isoDate)=>{
    const seconds = Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 1000));
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if(seconds < 45) return "just now";
    if(minutes < 60) return minutes <= 1 ? "1 minute ago" : `${minutes} minutes ago`;
    if(hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    if(days === 1) return "yesterday";
    if(days < 7) return `${days} days ago`;
    return formatTime(isoDate);
}
