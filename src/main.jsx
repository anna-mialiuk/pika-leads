import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { captureAttribution } from "./services/leads";
import App from "./App";

// шрифти з власного домену (без запитів до Google Fonts)
import "@fontsource-variable/manrope";
import "@fontsource-variable/unbounded";

import "./styles/index.sass";

captureAttribution();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
