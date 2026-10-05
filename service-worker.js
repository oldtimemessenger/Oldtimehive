const CACHE_NAME = "old-time-shell-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./app-icon.svg",
  "./app-icon-180.png",
  "./app-icon-192.png",
  "./app-icon-512.png",
  "./app/styles.css",
  "./app/app.js",
  "./app/main.js",
  "./app/store.js",
  "./app/chat.js",
  "./app/emoji.js",
  "./app/live.js",
  "./app/icons.js",
  "./app/avatar.svg",
  "./app/comms/index.js",
  "./app/comms/calls.js",
  "./app/comms/config.js",
  "./app/comms/signaling.js",
  "./app/comms/voice-notes.js"
];
const SHELL_URLS = new Set(
  SHELL_FILES.map(path => new URL(path, self.registration.scope).href)
);

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("old-time-shell-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (!SHELL_URLS.has(url.href)) return;
  event.respondWith(
    caches.match(request).then(response => response || fetch(request))
  );
});
