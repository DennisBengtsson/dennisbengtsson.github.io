/*
 * sok.js – söksidan (sok.html). Söker i blogginläggen och i sidorna i menyn.
 * Allt sker i webbläsaren; ingenting skickas någon annanstans.
 */
(function () {
    "use strict";
    const { url, lank, el, data } = window.SITE;
    const falt = document.getElementById("sokfalt");
    const ut = document.getElementById("sokresultat");
    const info = document.getElementById("sokinfo");
    if (!falt || !ut) return;

    const idag = new Date().toLocaleDateString("sv-SE");
    const norm = (s) => s.toLowerCase().normalize("NFC");

    const hamtaText = (adress, valjare) => fetch(adress)
        .then((s) => (s.ok ? s.text() : ""))
        .then((html) => {
            const doc = new DOMParser().parseFromString(html, "text/html");   // laddar och kör ingenting
            const omrade = doc.querySelector(valjare) || doc.querySelector(".content") || doc.body;
            omrade.querySelectorAll("script, [data-dynamisk]").forEach((e) => e.remove());
            return omrade.textContent.replace(/\s+/g, " ").trim();
        })
        .catch(() => "");

    // bygg sökindexet en gång
    const index = Promise.all([
        fetch(url("json/blog_posts.json")).then((s) => (s.ok ? s.json() : [])).catch(() => []),
        data
    ]).then(([poster, d]) => {
        const inlagg = (Array.isArray(poster) ? poster : [])
            .filter((p) => p && p.link && String(p.date).slice(0, 10) <= idag)
            .map((p) => hamtaText(lank(p.link), ".inlaggstext")
                .then((text) => ({ titel: p.title, adress: lank(p.link), datum: p.date, extra: [p.category, p.serie, p.description].join(" "), text })));
        const sidor = (d.menu || [])
            .filter((m) => m.url && !/^(blog|sok)\.html$/.test(m.url))
            .map((m) => hamtaText(lank(m.url), ".content")
                .then((text) => ({ titel: m.label, adress: lank(m.url), datum: "", extra: "", text })));
        return Promise.all([...inlagg, ...sidor]);
    });

    const utdrag = (text, ord) => {
        const t = norm(text);
        const i = Math.max(0, t.indexOf(ord[0]));
        const start = Math.max(0, i - 60);
        const bit = text.slice(start, start + 200);
        // markera träffarna utan att någonsin tolka text som HTML
        const p = el("p", { class: "text-muted mb-0" });
        if (start > 0) p.append("… ");
        const monster = new RegExp("(" + ord.map((o) => o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
        bit.split(monster).forEach((del, k) => p.append(k % 2 ? el("mark", {}, del) : del));
        if (start + 200 < text.length) p.append(" …");
        return p;
    };

    const sok = () => {
        const q = norm(falt.value.trim());
        try { history.replaceState(null, "", q ? "?q=" + encodeURIComponent(falt.value.trim()) : location.pathname); } catch (e) {}
        if (!q) { ut.replaceChildren(); info.textContent = ""; return; }
        const ord = q.split(/\s+/);
        index.then((poster) => {
            const traffar = poster.map((p) => {
                const titel = norm(p.titel || ""), extra = norm(p.extra), text = norm(p.text);
                let poang = 0;
                for (const o of ord) {
                    const d = (titel.includes(o) ? 10 : 0) + (extra.includes(o) ? 4 : 0) + (text.includes(o) ? 1 : 0);
                    if (!d) return null;
                    poang += d;
                }
                return { p, poang };
            }).filter(Boolean).sort((a, b) => b.poang - a.poang);
            info.textContent = traffar.length ? `${traffar.length} ${traffar.length === 1 ? "träff" : "träffar"}` : "Inga träffar.";
            ut.replaceChildren(...traffar.map(({ p }) => el("article", { class: "soktraff" },
                p.datum && el("small", { class: "text-muted" }, p.datum),
                el("h3", { class: "h5 font-weight-bold mb-1" }, el("a", { href: p.adress }, p.titel)),
                utdrag(p.text, ord))));
        });
    };

    falt.addEventListener("input", sok);
    const m = location.search.match(/[?&]q=([^&]*)/);
    if (m) { falt.value = decodeURIComponent(m[1].replace(/\+/g, " ")); sok(); }
    else falt.focus({ preventScroll: true });     // man kom hit via förstoringsglaset: börja skriva direkt
})();
