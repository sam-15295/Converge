// Opens the version history of the document.
const HistoryButton = ({ open, onClick })=>{
    return (
        <button
            type="button"
            aria-expanded={open}
            onClick={onClick}
            className="flex shrink-0 items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
            History
        </button>
    );
}

export default HistoryButton;
