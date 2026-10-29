// Service worker of the installable app. Pages and the API always come from the network, because the game needs
// the login and the cloud save; without a connection a page request shows offline.html. Hashed build files, icons
// and stadium sounds never change, so they are served from the cache once loaded.
const VERSION = "v1";
const STATIC_CACHE = `goal-clicker-static-${VERSION}`;
const OFFLINE_CACHE = `goal-clicker-offline-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const MAX_STATIC_ENTRIES = 200;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png", "/favicon.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith("goal-clicker-") && key !== STATIC_CACHE && key !== OFFLINE_CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

function isStatic(path) {
  return path.startsWith("/_next/static/") || path.startsWith("/icons/") || path.startsWith("/sounds/") || path === "/favicon.svg";
}

async function trimStaticCache(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES)).map((key) => cache.delete(key)));
}

async function cacheFirst(request) {
  // Also finds the files the install step put into the offline cache.
  const cached = await caches.match(request);
  if (cached) return cached;
  const cache = await caches.open(STATIC_CACHE);
  const response = await fetch(request);
  // Range requests (audio seeking) answer with 206, which the cache cannot store.
  if (response.ok && response.status === 200) { await cache.put(request, response.clone()); void trimStaticCache(cache); }
  return response;
}

async function networkOrOffline(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(OFFLINE_URL)) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (isStatic(url.pathname)) { event.respondWith(cacheFirst(request)); return; }
  if (request.mode === "navigate") event.respondWith(networkOrOffline(request));
});
