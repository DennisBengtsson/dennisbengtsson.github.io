(function ($) {
    "use strict";

    console.log("Main.js har startat...");

    /* =========================================
       1. HTML-MALLAR
       ========================================= */

    const headerHTML = `
        <nav class="navbar navbar-expand-lg bg-secondary navbar-dark">
            <a href="index.html" class="navbar-brand d-block d-lg-none">Meny</a>
            <button type="button" class="navbar-toggler" data-toggle="collapse" data-target="#navbarCollapse">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse justify-content-between" id="navbarCollapse">
                <div class="navbar-nav m-auto" id="header-menu-target">
                    <!-- Menyn genereras här -->
                </div>
            </div>
        </nav>
    `;

    const sidebarHTML = `
        <div class="sidebar pb-4 px-4">
            <div class="sidebar-text d-flex flex-column h-100 justify-content-center text-center">
                <div class="text-center py-4">
                    <img src="" alt="Profilbild" id="profile-image" class="mx-auto d-block w-75 bg-primary img-fluid rounded-circle mb-4 p-3">
                    <h4 class="font-weight-bold" id="profile-name">Laddar...</h4>
                    <p class="mb-4" id="profile-description"></p>

                    <div class="d-flex justify-content-center mb-5">
                        <a class="btn btn-outline-primary mr-2" href="#" target="_blank" rel="noopener noreferrer" id="telegram-link"><i class="fab fa-telegram"></i></a>
                        <a class="btn btn-outline-primary mr-2" href="#" target="_blank" rel="noopener noreferrer" id="goodreads-link"><i class="fab fa-goodreads"></i></a>
                        <a class="btn btn-outline-primary mr-2" href="#" target="_blank" rel="noopener noreferrer" id="linkedin-link"><i class="fab fa-linkedin-in"></i></a>
                        <a class="btn btn-outline-primary mr-2" href="#" target="_blank" rel="noopener noreferrer" id="instagram-link"><i class="fab fa-instagram"></i></a>
                    </div>

                    <a href="#" id="sidebar-contact-link" class="btn btn-lg btn-block btn-primary mt-auto">Kontakta mig</a>
                </div>
            </div>

            <div class="sidebar-icon d-flex flex-column h-100 justify-content-center text-right">
                <i class="fas fa-2x fa-angle-double-right text-primary"></i>
            </div>
        </div>
    `;

    /* Footer byggs dynamiskt i updatePageContent så email/telefon hämtas från data */
    const footerContainerId = "footer-container";

    /* =========================================
       2. FALLBACK-DATA
       ========================================= */
    const fallbackData = {
        name:           "Dennis Bengtsson",
        description:    "Certifierad snickare och betongarbetare.",
        pageTitleSuffix:" - Personlig Blogg",
        email:          "",
        phone:          "",
        phoneHref:      "#",
        address:        "",
        sidebar:        { profileImagePath: "img/about.jpg" },
        telegram:       "#",
        goodreads:      "#",
        linkedin:       "#",
        instagram:      "#",
        menu: [
            { "label": "Hem",    "url": "index.html",   "dataPage": "index"   },
            { "label": "Om mig", "url": "about.html",   "dataPage": "about"   },
            { "label": "Kontakt","url": "contact.html", "dataPage": "contact" }
        ]
    };

    /* =========================================
       3. FUNKTIONER
       ========================================= */

    const buildFooterHTML = (data) => `
        <div class="container py-4 bg-secondary text-center">
            <p class="m-0 text-white small">
                &copy; ${new Date().getFullYear()} <span id="footer-name">${data.name}</span>
                &bull; Alla rättigheter förbehållna &bull; Ingen datainsamling
            </p>
        </div>
    `;

    const initSite = async () => {
        $("#header-container").html(headerHTML);
        $("#sidebar-container").html(sidebarHTML);

        let data = fallbackData;

        try {
            const response = await fetch("data.json");
            if (response.ok) {
                data = await response.json();
            } else {
                console.warn("Kunde inte ladda data.json, använder fallback.");
            }
        } catch (error) {
            console.warn("Fetch-fel:", error);
        }

        $(`#${footerContainerId}`).html(buildFooterHTML(data));

        updatePageContent(data);
        generateMenu(data.menu);
        setActiveNavLink();
        populateContactPage(data);
    };

    const updatePageContent = (data) => {
        // Sidtitel
        const titleEl = document.getElementById("page-title");
        if (titleEl) {
            titleEl.textContent = data.name + (data.pageTitleSuffix || "");
        }

        // Sidebar
        $("#profile-name").text(data.name);
        $("#profile-description").text(data.description);
        $("#profile-image").attr("src", (data.sidebar && data.sidebar.profileImagePath) ? data.sidebar.profileImagePath : "img/about.jpg");

        // Sidebar kontaktknapp
        if (data.email) {
            $("#sidebar-contact-link").attr("href", "mailto:" + data.email);
        }

        // Sociala länkar
        $("#telegram-link").attr("href",  data.telegram  || "#");
        $("#goodreads-link").attr("href", data.goodreads || "#");
        $("#linkedin-link").attr("href",  data.linkedin  || "#");
        $("#instagram-link").attr("href", data.instagram || "#");
    };

    /* Fyller i kontaktsidan dynamiskt om elementen finns */
    const populateContactPage = (data) => {
        const emailEl   = document.getElementById("contact-email");
        const phoneEl   = document.getElementById("contact-phone");
        const addressEl = document.getElementById("contact-address");

        if (emailEl && data.email) {
            emailEl.href        = "mailto:" + data.email;
            emailEl.textContent = data.email;
        }
        if (phoneEl && data.phone) {
            phoneEl.href        = data.phoneHref || "#";
            phoneEl.textContent = data.phone;
        }
        if (addressEl && data.address) {
            addressEl.textContent = data.address;
        }
    };

    const generateMenu = (menuItems) => {
        let menuHTML = "";

        (menuItems || []).forEach(item => {
            if (item.dropdown) {
                menuHTML += `<div class="nav-item dropdown">
                    <a href="#" class="nav-link dropdown-toggle" data-toggle="dropdown">${item.label}</a>
                    <div class="dropdown-menu">`;
                item.dropdown.forEach(sub => {
                    menuHTML += `<a href="${sub.url}" class="dropdown-item" data-page="${sub.dataPage}">${sub.label}</a>`;
                });
                menuHTML += `</div></div>`;
            } else {
                menuHTML += `<a href="${item.url}" class="nav-item nav-link" data-page="${item.dataPage}">${item.label}</a>`;
            }
        });

        $("#header-menu-target").html(menuHTML);
    };

    const setActiveNavLink = () => {
        const page = (window.location.pathname.split("/").pop().replace(".html", "") || "index");
        $(".nav-link, .dropdown-item").removeClass("active");
        $(`[data-page="${page}"]`).addClass("active");
        $(`[data-page="${page}"]`).closest(".dropdown").find(".dropdown-toggle").addClass("active");
    };

    /* =========================================
       4. KÖR VID START
       ========================================= */
    $(document).ready(function () {
        initSite();

        $(window).scroll(function () {
            $(".back-to-top").toggle($(this).scrollTop() > 100);
        });

        $(".back-to-top").click(function () {
            $("html, body").animate({ scrollTop: 0 }, 1500, "swing");
            return false;
        });

        if ($("#blog-carousel").length) $("#blog-carousel").carousel();
        if ($("#news-carousel").length) $("#news-carousel").carousel();
    });

})(jQuery);