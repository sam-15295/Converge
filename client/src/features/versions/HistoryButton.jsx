// Opens the version history of the document.
const HistoryButton = ({ open, onClick })=>{
    return (
        <button
            type="button"
            aria-expanded={open}
            onClick={onClick}
            className="flex shrink-0 items-center gap-2 rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-body hover:bg-raised"
        >
            History
        </button>
    );
}

export default HistoryButton;
