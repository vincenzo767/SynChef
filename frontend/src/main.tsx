import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { store } from "./app/store";
import { applyTheme, readLocalTheme } from "./app/theme";
import { ToastProvider } from "./components/ui/Toast";
import { registerServiceWorker } from "./lib/pwa";
import "./styles/base.css";

applyTheme(readLocalTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>
);

registerServiceWorker();
