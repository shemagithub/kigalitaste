import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./lib/auth";
import { applyBrandAssets } from "./web/ui";

// Set favicon immediately from the live API (before settings finish loading).
applyBrandAssets({});

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
