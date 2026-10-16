/*
 * feed.js – nyhetskarusellen på startsidan.
 *
 * Flödena anges i data.json under "nyhetsfloden", t.ex.
 *   "nyhetsfloden": ["https://www.byggindustrin.se/feed/"]
 * Är listan tom visas ingen karusell alls, och inga anrop görs.
 *
 * Säkerhet:
 *  - Allt från flödet behandlas som opålitligt. Text sätts med textContent,
 *    aldrig som HTML, så ett kapat flöde kan inte köra kod på din sida.
 *  - Bilder letas upp med DOMParser, som läser HTML utan att köra eller ladda något.
 *  - Länkar måste vara https/http och bilder https, annars används reservbilden.
 *  - Säkerhetsregeln (CSP) på index.html tillåter bara anrop till api.rss2json.com.
 *
 * Integritet: rss2json är en utomstående tjänst. När flöden är ifyllda ser den
 * besökarens IP-adress när nyheterna hämtas.
 */
(function ($) {
    "use strict";
    const { url, lank, el, data } = window.SITE;

    const RESERVBILD = url("img/senaste.jpg");
    const MAX_NYHETER = 5;
    const TIDSGRANS_MS = 8000;

    const sektion = document.getElementById("page-content-container");
    const inre = document.getElementById("news-carousel-inner");
    if (!sektion || !inre) return;

    const hamtaFlode = (flode) => {
        const styrning = new AbortController();
        const timer = setTimeout(() => styrning.abort(), TIDSGRANS_MS);
        const api = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(flode);
        return fetch(api, { signal: styrning.signal, credentials: "omit", referrerPolicy: "no-referrer" })
            .then((svar) => (svar.ok ? svar.json() : null))
            .then((j) => (j && j.status === "ok" && Array.isArray(j.items) ? j.items : []))
            .finally(() => clearTimeout(timer));
    };

    const hittaBild = (post) => {
        const direkt = lank(post.thumbnail, ["https:"]) ||
            lank(post.enclosure && post.enclosure.link, ["https:"]);
        if (direkt) return direkt;
        const html = typeof post.content === "string" ? post.content : post.description;
        if (typeof html !== "string") return null;
        const doc = new DOMParser().parseFromString(html, "text/html"); // laddar inget, kör inget
        const img = doc.querySelector("img[src]");
        return img ? lank(img.getAttribute("src"), ["https:"]) : null;
    };

    const nyhet = (post, aktiv) => {
        const titel = String(post.title || "").slice(0, 200);
        const datum = new Date(post.pubDate);
        const href = lank(post.link);

        const bild = el("img", { class: "card-img-top", src: hittaBild(post) || RESERVBILD, alt: "", loading: "lazy" });
        bild.addEventListener("error", () => { if (bild.src !== RESERVBILD) bild.src = RESERVBILD; }, { once: true });

        return el("div", { class: "carousel-item" + (aktiv ? " active" : "") },
            el("div", { class: "container py-5" },
                el("div", { class: "row justify-content-center" },
                    el("div", { class: "col-md-8" },
                        el("div", { class: "card shadow border-0 nyhetskort" },
                            el("div", { class: "nyhetsbild" }, bild),
                            el("div", { class: "card-body text-center d-flex flex-column justify-content-between" },
                                el("h5", { class: "card-title font-weight-bold" }, titel),
                                !isNaN(datum) && el("small", { class: "text-muted mb-2" }, datum.toLocaleDateString("sv-SE")),
                                href && el("a", { href, target: "_blank", rel: "noopener noreferrer", class: "btn btn-primary mt-2" },
                                    "Läs hela artikeln")))))));
    };

    data.then((d) => {
        const floden = (Array.isArray(d.nyhetsfloden) ? d.nyhetsfloden : [])
            .map((f) => lank(f, ["https:"]))
            .filter(Boolean);

        if (!floden.length) {
            sektion.hidden = true;  // inga flöden ifyllda – visa ingenting
            return;
        }

        Promise.allSettled(floden.map(hamtaFlode)).then((resultat) => {
            const nyheter = resultat
                .filter((r) => r.status === "fulfilled")
                .flatMap((r) => r.value)
                .filter((p) => p && p.title)
                .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
                .slice(0, MAX_NYHETER);

            if (!nyheter.length) {
                sektion.hidden = true;
                return;
            }
            inre.replaceChildren(...nyheter.map((p, i) => nyhet(p, i === 0)));
            $("#news-carousel").carousel("dispose").carousel({ interval: 5000, pause: "hover" });
        });
    });
})(jQuery);
