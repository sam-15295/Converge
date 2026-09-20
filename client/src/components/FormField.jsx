// A labelled text input with an accessible error message.
// Extra props (type, value, onChange, autoComplete, required...) go straight to the <input>.
const FormField = ({ id, label, error, ...inputProps })=>{
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-body">
                {label}
            </label>
            <input
                id={id}
                name={id}
                aria-invalid={error ? "true" : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    error ? "border-danger-line" : "border-line-strong"
                }`}
                {...inputProps}
            />
            {error && (
                <p id={`${id}-error`} className="mt-1 text-sm text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}

export default FormField;
