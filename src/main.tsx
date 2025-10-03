/// <reference types="react" />
import { AuthProvider } from "hooks/useAuth";
import { UpsellProvider } from "hooks/useUpsell";
import { PwaInstallProvider } from "hooks/usePwaInstallPrompt";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/styles.css";
import "./styles/extras.css";
import { registerSW } from "virtual:pwa-register";

const container = document.getElementById("root");

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <UpsellProvider>
            <PwaInstallProvider>
              <App />
            </PwaInstallProvider>
          </UpsellProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

if ("serviceWorker" in navigator) {
  registerSW({ immediate: true });
}
