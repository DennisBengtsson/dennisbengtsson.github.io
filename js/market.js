/*
 * market.js – loppisen (market.html). Läser data/products.json.
 * "Köp / Intresse" öppnar ett färdigt mejl till adressen i data.json.
 */
(function ($) {
    "use strict";
    const { url, lank, el, data } = window.SITE;
    const lista = document.getElementById("product-list");
    if (!lista) return;

    const meddelande = (text, klass = "") =>
        lista.replaceChildren(el("div", { class: "col-12 text-center" }, el("p", { class: klass }, text)));

    const kort = (vara, epost) => {
        const sald = vara.status === "sold";
        const pris = Number.isFinite(Number(vara.price)) ? `${Number(vara.price)} kr` : "";

        let knapp;
        if (sald) {
            knapp = el("button", { class: "btn btn-secondary btn-block", disabled: true }, "Såld");
        } else if (epost) {
            const amne = `Intresse: ${vara.title}`;
            const text = `Hej Dennis!\nJag är intresserad av att köpa "${vara.title}"${pris ? " för " + pris : ""}.\nFinns den kvar?`;
            knapp = el("a", {
                class: "btn btn-primary btn-block",
                href: `mailto:${epost}?subject=${encodeURIComponent(amne)}&body=${encodeURIComponent(text)}`
            }, "Köp / Intresse");
        } else {
            knapp = el("a", { class: "btn btn-primary btn-block", href: url("contact.html") }, "Köp / Intresse");
        }

        const bildAdress = lank(vara.image);
        const bild = bildAdress && el("img", { class: "card-img-top", src: bildAdress, alt: vara.title || "", loading: "lazy" });
        if (bild) bild.addEventListener("error", () => bild.remove(), { once: true }); // grå ruta i stället för trasig bild

        return el("div", { class: "col-md-6 col-lg-4 mb-4" },
            el("div", { class: "card feature-card produkt h-100 p-0 overflow-hidden border-0 shadow-sm" + (sald ? " sald" : "") },
                el("span", { class: "badge position-absolute produktetikett " + (sald ? "badge-danger" : "badge-success") },
                    sald ? "SÅLD" : "TILL SALU"),
                el("div", { class: "produktbild" }, bild),
                el("div", { class: "card-body d-flex flex-column p-4" },
                    el("div", { class: "d-flex justify-content-between align-items-start mb-2" },
                        el("h5", { class: "card-title font-weight-bold mb-0" }, vara.title || ""),
                        pris && el("span", { class: "font-weight-bold text-primary" }, pris)),
                    el("p", { class: "card-text text-muted small flex-grow-1" }, vara.description || ""),
                    el("div", { class: "mt-3" }, knapp))));
    };

    Promise.all([
        fetch(url("data/products.json")).then((s) => (s.ok ? s.json() : Promise.reject())),
        data
    ]).then(([varor, d]) => {
        if (!Array.isArray(varor)) return meddelande("Kunde inte ladda varor.", "text-danger");
        const epost = typeof d.email === "string" && /^[^\s@<>"?&]+@[^\s@<>"?&]+$/.test(d.email) ? d.email : "";

        const visa = (kategori) => {
            const urval = kategori === "all" ? varor : varor.filter((v) => v.category === kategori);
            if (!urval.length) return meddelande("Inga varor i denna kategori.");
            lista.replaceChildren(...urval.map((v) => kort(v, epost)));
        };

        // en filterknapp per kategori som finns bland varorna
        const filter = document.getElementById("product-filter");
        if (filter) {
            const kategorier = [...new Set(varor.map((v) => v.category).filter(Boolean))];
            for (const k of kategorier) {
                filter.append(" ", el("button", { type: "button", class: "btn btn-sm btn-outline-primary filter-btn m-1",
                    "data-filter": k, "aria-pressed": "false" }, k));
            }
        }
        $(".filter-btn").on("click", function () {
            $(".filter-btn").removeClass("active").attr("aria-pressed", "false");
            $(this).addClass("active").attr("aria-pressed", "true");
            visa(this.dataset.filter);
        });
        visa("all");
    }).catch(() => meddelande("Kunde inte ladda varor.", "text-danger"));
})(jQuery);
