// The centered card shared by the login and signup pages.
const AuthCard = ({ title, subtitle, children, footer })=>{
    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
            <h1 className="text-3xl font-bold text-strong">{title}</h1>
            <p className="mt-1 text-body">{subtitle}</p>
            <section className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-sm">{children}</section>
            <p className="mt-4 text-center text-sm text-body">{footer}</p>
        </main>
    );
}

export default AuthCard;
