import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "@fontsource-variable/manrope";
import "@fontsource-variable/unbounded";
import "./lib/theme";
import "./styles.css";

import App from "./App";
import { AuthProvider } from "./lib/auth";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
