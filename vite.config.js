import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            "/smsmobileapi": {
                target: "https://api.smsmobileapi.com",
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/smsmobileapi/, ""); }
            }
        }
    },
    build: {
        target: "es2020"
    }
});
