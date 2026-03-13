import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installFunctionLogger } from "./lib/functionLoggerInterceptor";

// Install global function call logger (dev only)
if (import.meta.env.DEV) {
  installFunctionLogger();
}

createRoot(document.getElementById("root")!).render(<App />);
