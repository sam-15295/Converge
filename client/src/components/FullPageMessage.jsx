const FullPageMessage = ({ children })=>{
    return (
        <main className="flex min-h-screen items-center justify-center px-4 text-slate-500">
            <p>{children}</p>
        </main>
    );
}

export default FullPageMessage;
