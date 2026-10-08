import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import scaleMobileText from "./postcss/scale-mobile-text.js";
import pikaContent from "./vite-content.js";
import inlineCriticalCss from "./vite-inline-css.js";

const root = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pikaContent(), inlineCriticalCss()],
  // локальна перевірка заявок: `node server/leads/index.mjs` + VITE_LEADS_ENDPOINT=/api/leads
  server: { proxy: { "/api": "http://127.0.0.1:3010" } },
  preview: { proxy: { "/api": "http://127.0.0.1:3010" } },
  css: {
    postcss: {
      // на ≤1024px текст (крім h1/h2) трохи більший — див. postcss/scale-mobile-text.js
      plugins: [scaleMobileText({ srcDir: path.join(root, "src") })],
    },
  },
});
