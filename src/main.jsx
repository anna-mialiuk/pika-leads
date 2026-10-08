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

// Після деплою старі файли сторінок (assets/*.js) можуть зникнути, поки сайт відкритий.
// Тоді перехід на іншу сторінку не вантажиться — перезавантажуємо на нову версію
// (не частіше ніж раз на 10 секунд, щоб не зациклитись).
window.addEventListener("vite:preloadError", (event) => {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem("pl-chunk-reload")) || 0;
    sessionStorage.setItem("pl-chunk-reload", String(Date.now()));
  } catch {
    /* сховище недоступне */
  }
  if (Date.now() - last > 10_000) {
    event.preventDefault();
    window.location.reload();
  }
});

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
