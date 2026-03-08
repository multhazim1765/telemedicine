import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderStartupError = (message: string) => {
  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  const safeMessage = escapeHtml(message);

  root.innerHTML = `
    <div style="max-width:720px;margin:48px auto;padding:20px 22px;border:1px solid #fecaca;border-radius:16px;background:#fff1f2;color:#881337;font-family:Segoe UI, Arial, sans-serif;line-height:1.45;">
      <h2 style="margin:0 0 10px;font-size:20px;">Application startup error</h2>
      <p style="margin:0 0 8px;">The app hit an unexpected runtime error during initialization.</p>
      <pre style="white-space:pre-wrap;word-break:break-word;background:#ffffff;border:1px solid #fecdd3;padding:10px;border-radius:8px;">${safeMessage}</pre>
      <p style="margin:10px 0 0;font-size:13px;">Try hard refresh (Ctrl+F5). If this keeps showing, share this message with support.</p>
    </div>
  `;
};

let isBootstrapPhase = true;

const onStartupError = (event: ErrorEvent) => {
  if (!isBootstrapPhase) {
    return;
  }
  renderStartupError(event.error?.message ?? event.message ?? "Unknown startup error");
};

const onStartupUnhandledRejection = (event: PromiseRejectionEvent) => {
  if (!isBootstrapPhase) {
    return;
  }
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason ?? "Unhandled promise rejection");
  renderStartupError(message);
};

window.addEventListener("error", onStartupError);
window.addEventListener("unhandledrejection", onStartupUnhandledRejection);

const bootstrap = async () => {
  try {
    const [appModule, swModule, syncAgentModule, firestoreModule] = await Promise.all([
      import("./App"),
      import("./pwa/registerServiceWorker"),
      import("./agents/syncAgent"),
      import("./services/firestoreService")
    ]);

    swModule.registerServiceWorker();
    syncAgentModule.startAutoSync(firestoreModule.processSyncAction);

    const App = appModule.default;
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      throw new Error("Root element (#root) not found");
    }

    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    );
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    renderStartupError(message);
  } finally {
    isBootstrapPhase = false;
    window.removeEventListener("error", onStartupError);
    window.removeEventListener("unhandledrejection", onStartupUnhandledRejection);
  }
};

void bootstrap();
