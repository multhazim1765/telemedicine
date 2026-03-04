const CACHE_NAME = "rural-telehealth-v2";
const STATIC_ASSETS = ["/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(async () => (await caches.match("/index.html")) || Response.error())
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          const responseCopy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
          return response;
        })
        .catch(() => Response.error());
    })
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "telehealth-sync") {
    event.waitUntil(Promise.resolve());
  }
});
