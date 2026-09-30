import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Prevent Google Translate from breaking React DOM (insertBefore error)
if (typeof window !== "undefined") {
  // @ts-ignore
  window.addEventListener("error", (e) => {
    if (e.message && e.message.includes("insertBefore")) {
      console.warn("Suppressed insertBefore error likely from Google Translate", e.message);
      e.preventDefault();
    }
  });
  // Also suppress unhandled promise rejections from translation
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String(e.reason?.message || e.reason || "");
    if (msg.includes("insertBefore")) {
      e.preventDefault();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      if (import.meta.env.DEV) console.warn("ZXMAX service worker:", error);
    });
  });
}
