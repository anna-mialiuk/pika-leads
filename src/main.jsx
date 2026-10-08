import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { captureAttribution } from "./services/leads";
import { initConsent } from "./services/consent";
import App from "./App";

// шрифти з власного домену (без запитів до Google Fonts)
import "@fontsource-variable/manrope";
import "@fontsource-variable/unbounded";

import "./styles/index.sass";

captureAttribution();
initConsent();

const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

const container = document.getElementById("root");

// сторінка пререндерена (scripts/prerender.mjs) — «оживляємо» готовий HTML,
// інакше (npm run dev) — звичайний рендер
if (container.hasChildNodes()) hydrateRoot(container, app);
else createRoot(container).render(app);
