/*
 * SynChef service worker.
 *
 * - App shell (index.html) is network-first so deployments are picked up immediately; the cached
 *   copy is only used when offline.
 * - Hashed build assets, icons, images, globe textures and fonts are cache-first (immutable).
 * - API responses, WebSocket traffic and user uploads are NEVER cached: they can contain
 *   personal data and must always reflect the server's authoritative state.
 * - Bump VERSION to invalidate every cache on the next activation.
 */
const VERSION = "synchef-v2-2026-11-23";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/logo-mark.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isNeverCached(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws") || url.pathname.startsWith("/uploads/");
}

function isStaticAsset(url) {
  if (url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com") return true;
  if (url.origin !== self.location.origin) return false;
  return /^\/(assets|icons|images|textures)\//.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && isNeverCached(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok || response.type === "opaque") {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
