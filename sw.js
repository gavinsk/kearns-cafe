// Offline helper. Tries the network first (so menu edits show up right away),
// and falls back to the saved copy when there's no internet.
const CACHE = "kearns-cafe-v15";
const FILES = [
  "./", "index.html", "menu.html", "icons.js", "styles.css", "app.js", "checkout.js", "sounds.js", "voice.js", "cards.js", "scanner.js", "vendor/qrcode.js", "vendor/jsQR.js", "vendor/peerjs.min.js", "kitchen.js", "game.js", "surprise.js", "sync.js", "intercom.js",
  "menus/donuts.js", "menus/burgers.js",
  "manifest.json", "icons/icon.svg", "icons/icon-180.png", "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
