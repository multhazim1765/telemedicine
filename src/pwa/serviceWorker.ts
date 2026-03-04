/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
const CACHE_NAME = "rural-telehealth-v2";
const STATIC_ASSETS = ["/index.html", "/manifest.webmanifest"];
const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  void sw.skipWaiting();
});

sw.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener("fetch", (event: FetchEvent) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseCopy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", responseCopy));
          return response;
        })
        .catch(async () => (await caches.match("/index.html")) ?? Response.error())
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return networkResponse;
        })
        .catch(() => Response.error());
    })
  );
});

sw.addEventListener(
  "sync",
  ((event: Event) => {
    const syncEvent = event as ExtendableEvent & { tag?: string };
    if (syncEvent.tag === "telehealth-sync") {
      syncEvent.waitUntil(Promise.resolve());
    }
  }) as EventListener
);

export {};
