import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: 5173,
        // In development the browser talks only to Vite (same origin). Vite forwards
        // /api requests to Express, so there are no CORS issues and cookies (Phase 2) just work.
        // Socket.IO will be proxied here too in a later phase.
        proxy: {
            "/api": "http://localhost:5000"
        }
    }
});
