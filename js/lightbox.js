/*
 * lightbox.js – klicka på en bild för att se den stor.
 * Fungerar på bildgalleriet och på bilderna i inlägg och textsidor.
 * Bläddra med pilarna eller piltangenterna, stäng med Esc eller ett klick utanför.
 */
(function () {
    "use strict";
    const galleriLankar = [...document.querySelectorAll(".gallery-link")];
    const bilder = galleriLankar.length
        ? galleriLankar.map((a) => ({ src: a.getAttribute("href"), alt: (a.querySelector("img") || {}).alt || "", el: a }))
        : [...document.querySelectorAll(".inlaggstext img, img.inlaggsbild")]
            .filter((img) => !img.closest("a"))
            .map((img) => ({ src: img.getAttribute("src"), alt: img.alt || "", el: img }));
    if (!bilder.length) return;

    // ljuslådan finns i bilder.html; på andra sidor skapas den här
    let lada = document.getElementById("lightbox");
    if (!lada) {
        lada = document.createElement("div");
        lada.id = "lightbox";
        lada.setAttribute("role", "dialog");
        lada.setAttribute("aria-modal", "true");
        lada.setAttribute("aria-label", "Bildvisning");
        lada.innerHTML =
            '<div class="lightbox-overlay"></div>' +
            '<button type="button" class="close-icon" aria-label="Stäng"><i class="fas fa-times" aria-hidden="true"></i></button>' +
            '<button type="button" id="prevBtn" class="pil vanster" aria-label="Föregående bild">&#10094;</button>' +
            '<img id="lightbox-bild" alt="">' +
            '<button type="button" id="nextBtn" class="pil hoger" aria-label="Nästa bild">&#10095;</button>' +
            '<div id="bild-nummer"></div>';
        document.body.append(lada);
    }

    const bild = lada.querySelector("#lightbox-bild");
    const nummer = lada.querySelector("#bild-nummer");
    const ensam = bilder.length < 2;
    lada.querySelector("#prevBtn").hidden = ensam;
    lada.querySelector("#nextBtn").hidden = ensam;
    let nu = 0, senastFokus = null;

    const visa = (i) => {
        nu = (i + bilder.length) % bilder.length;
        bild.src = bilder[nu].src;
        bild.alt = bilder[nu].alt;
        nummer.textContent = ensam ? "" : `${nu + 1} / ${bilder.length}`;
    };
    const oppna = (i) => {
        senastFokus = document.activeElement;
        visa(i);
        lada.classList.add("oppen");
        document.body.style.overflow = "hidden";
        lada.querySelector(".close-icon").focus();
    };
    const stang = () => {
        lada.classList.remove("oppen");
        document.body.style.overflow = "";
        if (senastFokus) senastFokus.focus();
    };

    bilder.forEach((b, i) => {
        b.el.classList.add("zoombar");
        b.el.addEventListener("click", (e) => { e.preventDefault(); oppna(i); });
    });
    lada.querySelector("#prevBtn").addEventListener("click", () => visa(nu - 1));
    lada.querySelector("#nextBtn").addEventListener("click", () => visa(nu + 1));
    lada.querySelector(".close-icon").addEventListener("click", stang);
    lada.querySelector(".lightbox-overlay").addEventListener("click", stang);
    document.addEventListener("keydown", (e) => {
        if (!lada.classList.contains("oppen")) return;
        if (e.key === "Escape") stang();
        else if (e.key === "ArrowLeft" && !ensam) visa(nu - 1);
        else if (e.key === "ArrowRight" && !ensam) visa(nu + 1);
    });
})();
