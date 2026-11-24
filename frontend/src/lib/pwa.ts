/**
 * Registers the service worker in production builds only (it would otherwise cache dev modules).
 * The worker never caches /api, /ws or /uploads responses — see public/sw.js.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.warn("Service worker registration failed", error);
    });
  });
}
