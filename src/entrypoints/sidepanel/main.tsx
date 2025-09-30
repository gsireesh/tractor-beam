import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/entrypoints/sidepanel/sidepanel.css";
import App from "@/entrypoints/sidepanel/App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
