import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./app.css";
import { AppFlowProvider } from "./state/appFlow";
import { OnlineSessionProvider } from "./state/onlineSession";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <OnlineSessionProvider>
      <AppFlowProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppFlowProvider>
    </OnlineSessionProvider>
  </StrictMode>
);
