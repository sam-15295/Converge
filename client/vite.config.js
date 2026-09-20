import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Which backend this dev server talks to. It is almost always the only one (port 5000), but running a SECOND pair
// (a backend and a Vite) is how you watch two servers work together through Redis in a real browser:
//   VITE_API_TARGET=http://localhost:5001 npx vite --port 5174
const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:5000";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    build: {
        // The document page (editor + Yjs + socket client) is one big chunk on purpose : it is loaded only when a
        // document is opened, so it does not slow down the first page load. The default warning would always show.
        chunkSizeWarningLimit: 700
    },
    server: {
        port: 5173,
        // In development the browser talks only to Vite (same origin). Vite forwards
        // /api requests to Express, so there are no CORS issues and cookies (Phase 2) just work.
        // Socket.IO will be proxied here too in a later phase.
        proxy: {
            "/api": apiTarget,
            // real-time editing : the WebSocket connection has to be forwarded as well ("ws")
            "/socket.io": { target: apiTarget, ws: true }
        }
    }
});
