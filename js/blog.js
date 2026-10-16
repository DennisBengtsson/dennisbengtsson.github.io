/*
 * blog.js – blogglistan (blog.html) och allt som hör till ett inlägg:
 * Föregående/Nästa, serier, innehållsförteckning och fotnoter.
 * Läser json/blog_posts.json. Kräver main.js.
 *
 * Schemalagda inlägg: ett inlägg med datum i framtiden visas inte i listan
 * eller i bläddringen förrän det datumet.
 */
(function () {
    "use strict";
    const { url, lank, el } = window.SITE;

    const idag = new Date().toLocaleDateString("sv-SE");   // ÅÅÅÅ-MM-DD i lokal tid
    const giltig = (p) => p && typeof p.title === "string" && typeof p.link === "string" &&
        !isNaN(new Date(p.date).getTime());

    // JSON-filen har nyaste först. Vi sorterar på datum och låter filens ordning avgöra vid lika datum.
    const inlagg = fetch(url("json/blog_posts.json"))
        .then((svar) => (svar.ok ? svar.json() : []))
        .catch(() => [])
        .then((lista) => (Array.isArray(lista) ? lista.filter(giltig) : []))
        .then((lista) => lista
            .filter((p) => String(p.date).slice(0, 10) <= idag)
            .map((p, i) => ({ ...p, ordning: i }))
            .sort((a, b) => new Date(b.date) - new Date(a.date) || a.ordning - b.ordning));

    const filnamn = (adress) => adress.split("/").pop().replace(/\.html$/, "").toLowerCase();

    /* ---------- blogglistan ---------- */
    const lista = document.getElementById("blog-list");
    if (lista) {
        inlagg.then((poster) => {
            lista.replaceChildren();
            if (!poster.length) {
                lista.append(el("p", { class: "text-muted" }, "Inga inlägg än."));
                return;
            }
            for (const p of poster) {
                const href = lank(p.link);
                const bild = lank(p.image);
                lista.append(
                    el("article", { class: "row blog-item px-3 pb-5" },
                        el("div", { class: "col-md-5" },
                            bild && el("a", { href, tabindex: "-1", "aria-hidden": "true" },
                                el("img", { class: "img-fluid mb-4 mb-md-0", src: bild, alt: "", loading: "lazy" }))),
                        el("div", { class: "col-md-7" },
                            el("h3", { class: "mt-md-4 px-md-3 mb-2 py-2 bg-white font-weight-bold" },
                                el("a", { href, class: "text-reset" }, p.title)),
                            el("div", { class: "d-flex flex-wrap mb-3 px-md-3" },
                                el("small", { class: "mr-3 text-muted" }, el("i", { class: "fa fa-calendar-alt" }), " ", p.date),
                                p.category && el("small", { class: "mr-3 text-muted" }, el("i", { class: "fa fa-folder" }), " ", p.category),
                                p.serie && el("small", { class: "text-muted" }, el("i", { class: "fa fa-layer-group" }), " ", p.serie)),
                            p.description && el("p", { class: "px-md-3" }, p.description),
                            el("div", { class: "px-md-3" },
                                el("a", { class: "btn btn-sm btn-outline-primary", href },
                                    "Läs mer ", el("i", { class: "fa fa-angle-right" }))))));
            }
        });
    }

    /* ---------- ett inlägg ---------- */
    const text = document.querySelector(".inlaggstext");
    if (text) {
        fotnoter(text);
        innehall(text);
    }

    const forra = document.querySelector(".prev-post");
    const nasta = document.querySelector(".next-post");
    if (forra && nasta) {
        inlagg.then((poster) => {
            const nu = filnamn(location.pathname);
            const i = poster.findIndex((p) => filnamn(p.link) === nu);
            // poster[i + 1] är äldre, poster[i - 1] är nyare
            sattKnapp(forra, i >= 0 ? poster[i + 1] : null, "Föregående inlägg", "Inget tidigare inlägg");
            sattKnapp(nasta, i > 0 ? poster[i - 1] : null, "Nästa inlägg", "Inget nyare inlägg");
            if (i >= 0 && text) serie(poster[i], poster, text);
        });
    }

    function sattKnapp(a, post, etikett, tomText) {
        const href = post && lank(post.link);
        if (href) {
            a.href = href;
            a.textContent = etikett;
            a.title = post.title;
            a.classList.remove("disabled");
            a.removeAttribute("aria-disabled");
            a.removeAttribute("tabindex");
        } else {
            a.removeAttribute("href");
            a.textContent = tomText;
            a.classList.add("disabled");
            a.setAttribute("aria-disabled", "true");
            a.setAttribute("tabindex", "-1");
        }
    }

    /** Inlägg med samma "serie" får en ruta med alla delar i ordning, äldst först. */
    function serie(post, poster, text) {
        if (!post.serie) return;
        const delar = poster.filter((p) => p.serie === post.serie).reverse();
        if (delar.length < 2) return;
        const nr = delar.indexOf(post) + 1;
        text.before(el("aside", { class: "serie", "aria-label": "Serie" },
            el("p", {}, `Del ${nr} av ${delar.length} i serien `, el("strong", {}, post.serie)),
            el("ol", {}, delar.map((p) => el("li", { class: p === post ? "nu" : null },
                p === post ? p.title : el("a", { href: lank(p.link) }, p.title))))));
    }

    /** Tre eller fler rubriker ger en innehållsförteckning överst. */
    function innehall(text) {
        const rubriker = [...text.querySelectorAll("h2, h3")];
        if (rubriker.length < 3) return;
        const anvanda = new Set();
        const punkter = rubriker.map((h) => {
            let id = h.textContent.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o")
                .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rubrik";
            while (anvanda.has(id) || document.getElementById(id)) id += "-2";
            anvanda.add(id);
            h.id = id;
            return el("li", { class: "niva-" + h.tagName[1] }, el("a", { href: "#" + id }, h.textContent));
        });
        text.before(el("nav", { class: "innehall", "aria-label": "Innehåll" },
            el("details", { open: true }, el("summary", {}, "Innehåll"), el("ol", {}, punkter))));
    }

    /** <sup class="fotnot"> i texten kopplas ihop med raderna i <ol class="fotnoter">. */
    function fotnoter(text) {
        const markeringar = [...text.querySelectorAll("sup.fotnot")];
        const noter = [...text.querySelectorAll("ol.fotnoter > li")];
        markeringar.forEach((sup, i) => {
            const n = i + 1;
            sup.replaceChildren(el("a", { href: "#fn-" + n, id: "fnref-" + n, "aria-label": "Fotnot " + n }, String(n)));
        });
        noter.forEach((li, i) => {
            const n = i + 1;
            li.id = "fn-" + n;
            if (markeringar[i]) li.append(" ", el("a", { href: "#fnref-" + n, class: "tillbaka", "aria-label": "Tillbaka till texten" }, "↩"));
        });
    }
})();
