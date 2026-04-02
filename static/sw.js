/**
 * Minimal service worker so the UI qualifies as an installable PWA (Chrome / Edge "Install" in address bar).
 * Scope: /ui/ — does not intercept /api/v1.
 */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
