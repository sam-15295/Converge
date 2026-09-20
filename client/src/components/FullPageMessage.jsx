const FullPageMessage = ({ children })=>{
    return (
        <main className="flex min-h-[calc(100dvh-3rem)] items-center justify-center px-4 text-muted">
            <p>{children}</p>
        </main>
    );
}

export default FullPageMessage;
