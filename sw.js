"use strict";
const CACHE = "pixel-obby-v5-trial";
const ROOT = new URL("./", self.location.href);
const FILES = ["", "index.html", "play/", "play/index.html", "landing.css", "landing.js", "style.css", "responsive-panels.css", "responsive-scale-v2.css", "game.js", "cloud-sync.js", "analytics.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
const URLS = FILES.map(path => new URL(path, ROOT).href);
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("pixel-obby-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  // Never cache auth callbacks, API responses, or third-party requests.
  if (event.request.method !== "GET" || url.search || !URLS.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === "basic") await cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});
