import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/smsmobileapi": {
        target: "https://api.smsmobileapi.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/smsmobileapi/, "")
      }
    }
  },
  build: {
    target: "es2020"
  }
});
