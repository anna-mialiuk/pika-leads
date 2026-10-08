import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Локальна розробка: бекенд (server/leads) на :3010, запити /api/* проксюються туди
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, proxy: { "/api": "http://127.0.0.1:3010" } },
  preview: { port: 4174, proxy: { "/api": "http://127.0.0.1:3010" } },
});
