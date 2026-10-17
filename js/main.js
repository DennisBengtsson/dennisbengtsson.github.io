/*
 * main.js – körs på alla sidor.
 * Bygger meny, sidopanel och sidfot, och fyller i dina uppgifter från data.json.
 *
 * Säkerhet: all text från data.json sätts med textContent (aldrig som HTML),
 * och länkar kontrolleras innan de används.
 *
 * Andra skript kan använda window.SITE:
 *   SITE.url("data.json")   – adress relativt sidans rot, fungerar även i undermappar
 *   SITE.data               – ett löfte (Promise) med innehållet i data.json
 *   SITE.lank(adress, ...)  – en kontrollerad länk, eller null om den inte är tillåten
 *   SITE.el(tagg, attr, ...barn) – skapar ett element säkert
 */
(function ($) {
    "use strict";

    // Sidans rot räknas ut från var main.js ligger (js/main.js -> ../)
    const ROT = new URL("..", document.currentScript.src);
    const url = (sokvag) => new URL(sokvag, ROT).href;

    /** Returnerar en säker adress, eller null. Tillåter bara de protokoll som anges. */
    const lank = (adress, protokoll = ["https:", "http:"]) => {
        if (typeof adress !== "string" || !adress.trim()) return null;
        try {
            const u = new URL(adress.trim(), ROT);
            return protokoll.includes(u.protocol) ? u.href : null;
        } catch (e) {
            return null;
        }
    };

    /** Skapar ett element. Text blir alltid text, aldrig HTML. */
    const el = (tagg, attr = {}, ...barn) => {
        const e = document.createElement(tagg);
        for (const [k, v] of Object.entries(attr)) {
            if (v === null || v === undefined || v === false) continue;
            if (k === "class") e.className = v;
            else e.setAttribute(k, v === true ? "" : v);
        }
        for (const b of barn.flat()) {
            if (b === null || b === undefined || b === false) continue;
            e.append(b instanceof Node ? b : document.createTextNode(String(b)));
        }
        return e;
    };

    const reserv = {
        name: "Dennis Bengtsson",
        description: "",
        pageTitleSuffix: "",
        email: "",
        phone: "",
        phoneHref: "",
        address: "",
        sidebar: { profileImagePath: "img/profile.jpg" },
        menu: [
            { label: "Hem", url: "index.html", dataPage: "index" },
            { label: "Om mig", url: "about.html", dataPage: "about" },
            { label: "Kontakt", url: "contact.html", dataPage: "contact" }
        ]
    };

    const data = fetch(url("data.json"))
        .then((svar) => (svar.ok ? svar.json() : {}))
        .catch(() => ({}))
        .then((d) => Object.assign({}, reserv, d));

    window.SITE = { url, lank, el, data };

    /* ---------- statiska mallar (innehåller ingen data) ---------- */

    const menyHTML = `
        <nav class="navbar navbar-expand-lg bg-secondary navbar-dark" aria-label="Huvudmeny">
            <a class="navbar-brand d-block d-lg-none" id="meny-hem">Meny</a>
            <a class="nav-link sok-ikon ml-auto order-lg-last" id="sok-ikon" aria-label="Sök" title="Sök"><i class="fa fa-search" aria-hidden="true"></i></a>
            <button type="button" class="navbar-toggler" data-toggle="collapse" data-target="#navbarCollapse"
                    aria-controls="navbarCollapse" aria-expanded="false" aria-label="Visa meny">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse justify-content-between" id="navbarCollapse">
                <div class="navbar-nav m-auto" id="header-menu-target"></div>
            </div>
        </nav>`;

    const sidopanelHTML = `
        <div class="sidebar pb-4 px-4">
            <div class="sidebar-text d-flex flex-column h-100 justify-content-center text-center">
                <div class="text-center py-4">
                    <img alt="Profilbild" id="profile-image" class="mx-auto d-block w-75 bg-primary img-fluid rounded-circle mb-4 p-3">
                    <h4 class="font-weight-bold" id="profile-name"></h4>
                    <p class="mb-4" id="profile-description"></p>

                    <div class="d-flex justify-content-center mb-5">
                        <a class="btn btn-outline-primary mr-2" target="_blank" rel="noopener noreferrer" id="telegram-link" aria-label="Telegram"><i class="fab fa-telegram"></i></a>
                        <a class="btn btn-outline-primary mr-2" target="_blank" rel="noopener noreferrer" id="goodreads-link" aria-label="Goodreads"><i class="fab fa-goodreads"></i></a>
                        <a class="btn btn-outline-primary mr-2" target="_blank" rel="noopener noreferrer" id="linkedin-link" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
                        <a class="btn btn-outline-primary mr-2" target="_blank" rel="noopener noreferrer" id="instagram-link" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
                    </div>

                    <a id="sidebar-contact-link" class="btn btn-lg btn-block btn-primary mt-auto">Kontakta mig</a>
                </div>
            </div>

            <div class="sidebar-icon d-flex flex-column h-100 justify-content-center text-right">
                <i class="fas fa-2x fa-angle-double-right text-primary"></i>
            </div>
        </div>`;

    const sidfotHTML = `
        <div class="container py-4 bg-secondary text-center">
            <p class="m-0 text-white small">
                &copy; <span id="footer-year"></span> <span id="footer-name"></span>
                &bull; Alla rättigheter förbehållna &bull; Ingen datainsamling
            </p>
        </div>`;

    /* ---------- fyll i sidan ---------- */

    const sattLank = (id, adress) => {
        const a = document.getElementById(id);
        if (!a) return;
        if (adress) a.href = adress;
        else a.removeAttribute("href");
    };

    const byggMeny = (poster) => {
        const mal = document.getElementById("header-menu-target");
        if (!mal) return;
        const sida = (location.pathname.split("/").pop().replace(/\.html$/, "") || "index");
        for (const post of poster || []) {
            const href = lank(post.url);
            if (!href || !post.label) continue;
            if (/(^|\/)sok\.html$/.test(post.url)) continue;          // sökningen är förstoringsglaset
            const a = el("a", { href, class: "nav-item nav-link", "data-page": post.dataPage }, post.label);
            if (post.dataPage === sida) {
                a.classList.add("active");
                a.setAttribute("aria-current", "page");
            }
            mal.append(a);
        }
    };

    const fyllSidan = (d) => {
        $("#profile-name").text(d.name || "");
        $("#profile-description").text(d.description || "");
        const bild = lank((d.sidebar && d.sidebar.profileImagePath) || "img/profile.jpg");
        if (bild) $("#profile-image").attr("src", bild);

        const epost = typeof d.email === "string" && /^[^\s@<>"]+@[^\s@<>"]+$/.test(d.email) ? d.email : "";
        sattLank("sidebar-contact-link", epost ? "mailto:" + epost : url("contact.html"));

        sattLank("telegram-link", lank(d.telegram, ["https:"]));
        sattLank("goodreads-link", lank(d.goodreads, ["https:"]));
        sattLank("linkedin-link", lank(d.linkedin, ["https:"]));
        sattLank("instagram-link", lank(d.instagram, ["https:"]));

        $("#footer-year").text(new Date().getFullYear());
        $("#footer-name").text(d.name || "");

        // kontaktsidan: en uppgift som är tom eller "-" döljs
        const tom = (v) => !v || !String(v).trim() || String(v).trim() === "-";
        const dolj = (el) => { const kol = el && el.closest(".col-sm-4"); if (kol) kol.style.display = "none"; };
        const epostLank = document.getElementById("contact-email");
        if (epostLank) {
            if (epost) { epostLank.href = "mailto:" + epost; epostLank.textContent = epost; } else dolj(epostLank);
        }
        const telefon = document.getElementById("contact-phone");
        if (telefon) {
            if (tom(d.phone)) dolj(telefon);
            else {
                telefon.textContent = d.phone;
                const tel = lank(d.phoneHref, ["tel:"]);
                if (tel) telefon.href = tel; else telefon.removeAttribute("href");
            }
        }
        const adress = document.getElementById("contact-address");
        if (adress) { if (tom(d.address)) dolj(adress); else adress.textContent = d.address; }

        byggMeny(d.menu);
    };

    $(function () {
        $("#header-container").html(menyHTML);
        $("#sidebar-container").html(sidopanelHTML);
        $("#footer-container").html(sidfotHTML);
        document.getElementById("meny-hem").href = url("index.html");
        const sok = document.getElementById("sok-ikon");
        sok.href = url("sok.html");
        if (/(^|\/)sok\.html$/.test(location.pathname)) {
            sok.classList.add("active");
            sok.setAttribute("aria-current", "page");
        }

        data.then(fyllSidan);

        // till toppen-knappen
        const upp = $(".back-to-top");
        $(window).on("scroll", function () { upp.toggle($(this).scrollTop() > 100); });
        upp.on("click", function () {
            $("html, body").animate({ scrollTop: 0 }, 1500, "swing");
            return false;
        });
    });
})(jQuery);
