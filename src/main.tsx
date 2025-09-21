/// <reference types="react" />
import { AuthProvider } from "hooks/useAuth";
import { UpsellProvider } from "hooks/useUpsell";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/styles.css";

const container = document.getElementById("root");

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <UpsellProvider>
            <App />
          </UpsellProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
