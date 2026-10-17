/*
 * sw.js – gör att Skriv startar även utan nät (utkasten ligger på telefonen).
 * Bara appens egna filer sparas här. Anrop till GitHub går alltid direkt ut på nätet.
 */
const VERSION = "skriv-1";
const FILER = ["./", "index.html", "skriv.js", "skriv.css", "manifest.webmanifest", "ikon.svg", "ikon-192.png", "ikon-512.png",
    "../css/opensans.css"];

self.addEventListener("install", (h) => {
    h.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILER)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (h) => {
    h.waitUntil(caches.keys()
        .then((nycklar) => Promise.all(nycklar.filter((k) => k.startsWith("skriv-") && k !== VERSION).map((k) => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (h) => {
    const u = new URL(h.request.url);
    if (h.request.method !== "GET" || u.origin !== location.origin) return;     // GitHub: alltid nätet
    if (u.pathname.endsWith("/json/blog_posts.json")) return;                    // kategorierna: alltid färska
    // nätet först, så att uppdateringar av appen syns direkt; sparad kopia om nätet saknas
    h.respondWith(fetch(h.request).then((svar) => {
        if (svar.ok && (u.pathname.includes("/skriv/") || u.pathname.includes("/fonts/") || u.pathname.endsWith("/css/opensans.css"))) {
            const kopia = svar.clone();
            caches.open(VERSION).then((c) => c.put(h.request, kopia));
        }
        return svar;
    }).catch(() => caches.match(h.request).then((s) => s || caches.match("index.html"))));
});
