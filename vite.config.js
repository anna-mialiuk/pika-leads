import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import scaleMobileText from "./postcss/scale-mobile-text.js";

const root = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      // на ≤1024px текст (крім h1/h2) трохи більший — див. postcss/scale-mobile-text.js
      plugins: [scaleMobileText({ srcDir: path.join(root, "src") })],
    },
  },
});
