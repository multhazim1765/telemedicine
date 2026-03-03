/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
const CACHE_NAME = "rural-telehealth-v1";
const STATIC_ASSETS = ["/", "/index.html", "/manifest.webmanifest"];
const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

sw.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
});

sw.addEventListener("fetch", (event: FetchEvent) => {
  event.respondWith(
    caches.match(event.request).then((response) => response ?? fetch(event.request))
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
