import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import UpdatePrompt from "./UpdatePrompt";
import { AuthProvider } from "./lib/auth";
import { PwaProvider } from "./lib/pwa";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PwaProvider>
      <AuthProvider>
        <UpdatePrompt />
        <App />
      </AuthProvider>
    </PwaProvider>
  </React.StrictMode>
);
