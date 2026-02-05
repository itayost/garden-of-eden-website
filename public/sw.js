// Minimal service worker for PWA installability
// Caches the app shell for offline support

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Let Next.js handle all requests — pass through
  // This SW exists primarily to enable PWA installability
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response("Offline", {
            status: 503,
            statusText: "Service Unavailable",
          })
      )
    );
  }
});
