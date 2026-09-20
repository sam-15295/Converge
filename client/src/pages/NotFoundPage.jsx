import { Link } from "react-router-dom";

const NotFoundPage = ()=>{
    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
            <h1 className="text-3xl font-bold text-strong">404</h1>
            <p className="mt-2 text-body">This page does not exist.</p>
            <Link to="/" className="mt-4 text-sm font-medium text-strong underline">
                Back to home
            </Link>
        </main>
    );
}

export default NotFoundPage;
