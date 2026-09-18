import { BrowserRouter, Route, Routes } from "react-router-dom";
import NotFoundPage from "./pages/NotFoundPage";
import StatusPage from "./pages/StatusPage";

const App = ()=>{
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<StatusPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
