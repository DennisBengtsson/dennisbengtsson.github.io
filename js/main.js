(function ($) {
    "use strict";

    console.log("Main.js har startat..."); // Kontroll för att se att scriptet laddas

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
                <div class="navbar-nav m-auto" id="mobile-menu-target"></div>
            </div>
        </nav>
    `;

    const sidebarHTML = `
        <div class="sidebar pb-4 px-4">
            <div class="sidebar-text">
                <div class="text-center py-4">
                    <img src="img/about.jpg" alt="Profilbild" id="profile-image" class="img-fluid rounded-circle mb-3 shadow-sm" style="width: 150px; height: 150px; object-fit: cover;">
                    <h4 class="font-weight-bold" id="profile-name">Laddar...</h4>
                    <p class="text-muted small mb-4" id="profile-description"></p>
                    
                    <div class="d-flex justify-content-center mb-4">
                        <a class="btn btn-outline-primary btn-sm mr-2" href="#" id="telegram-link"><i class="fab fa-telegram"></i></a>
                        <a class="btn btn-outline-primary btn-sm mr-2" href="#" id="goodreads-link"><i class="fab fa-goodreads"></i></a>
                        <a class="btn btn-outline-primary btn-sm mr-2" href="#" id="linkedin-link"><i class="fab fa-linkedin-in"></i></a>
                        <a class="btn btn-outline-primary btn-sm mr-2" href="#" id="instagram-link"><i class="fab fa-instagram"></i></a>
                    </div>
                </div>
                
                <nav class="nav flex-column text-center" id="sidebar-menu-target"></nav>

                <div class="text-center mt-5">
                    <a href="mailto:dennisrmgbengtsson@gmail.com" class="btn btn-primary btn-sm mb-3">Kontakta mig</a>
                    <p class="m-0 small text-muted">
                        &copy; 2025 <span id="footer-name">Dennis Bengtsson</span>.<br>Alla rättigheter förbehållna.
                    </p>
                </div>
            </div>
            <div class="sidebar-icon d-flex flex-column align-items-center justify-content-center h-100">
                <a href="index.html" class="p-3 text-primary"><i class="fas fa-home fa-2x"></i></a>
                <a href="about.html" class="p-3 text-primary"><i class="fas fa-user fa-2x"></i></a>
            </div>
        </div>
    `;

    const footerHTML = ``;

    /* =========================================
       2. DATA (BACKUP OM JSON INTE FUNKAR)
       ========================================= */
    const fallbackData = {
        name: "Dennis Bengtsson",
        description: "Certifierad snickare och betongarbetare. Vanligt sunt bonnförnuft räcker långt.",
        pageTitleSuffix: " - Personlig Blogg",
        sidebar: { profileImagePath: "img/about.jpg" },
        telegram: "#",
        goodreads: "https://www.goodreads.com/",
        linkedin: "https://linkedin.com/",
        instagram: "https://instagram.com/",
        menu: [
            { "label": "Hem", "url": "index.html", "dataPage": "index" },
            { "label": "Om mig", "url": "about.html", "dataPage": "about" },
            { "label": "Kontakt", "url": "contact.html", "dataPage": "contact" }
        ]
    };

    /* =========================================
       3. FUNKTIONER
       ========================================= */

    const initSite = async () => {
        // 1. Lägg in HTML direkt så att rutorna syns
        $("#header-container").html(headerHTML);
        $("#sidebar-container").html(sidebarHTML);
        $("#footer-container").html(footerHTML);
        console.log("HTML injicerat i sidebar/header");

        let data = fallbackData; // Börja med backup-data

        // 2. Förs��k hämta JSON
        try {
            const response = await fetch('data.json');
            if (response.ok) {
                data = await response.json();
                console.log("Data hämtad från data.json");
            }
        } catch (error) {
            console.warn("Kunde inte ladda data.json, använder backup-data.");
        }

        // 3. Fyll i texten
        populateData(data);
        generateMenus(data.menu);
        setActiveNavLink();
    };

    const populateData = (data) => {
        if (document.getElementById('page-title')) {
            document.getElementById('page-title').textContent = data.name + (data.pageTitleSuffix || '');
        }

        $("#profile-name").text(data.name);
        $("#footer-name").text(data.name);
        $("#profile-description").text(data.description);

        if (data.sidebar && data.sidebar.profileImagePath) {
            $("#profile-image").attr("src", data.sidebar.profileImagePath);
        }

        $("#telegram-link").attr("href", data.telegram);
        $("#goodreads-link").attr("href", data.goodreads);
        $("#linkedin-link").attr("href", data.linkedin);
        $("#instagram-link").attr("href", data.instagram);
    };

    const generateMenus = (menuItems) => {
        // Mobilmeny
        let mobileMenuHTML = '';
        if(menuItems) {
            menuItems.forEach(item => {
                mobileMenuHTML += `<a href="${item.url}" class="nav-item nav-link" data-page="${item.dataPage}">${item.label}</a>`;
            });
        }
        $("#mobile-menu-target").html(mobileMenuHTML);

        // Desktopmeny (Sidebar)
        let sidebarMenuHTML = '';
        if(menuItems) {
            menuItems.forEach(item => {
                sidebarMenuHTML += `
                    <a class="nav-link font-weight-bold py-2 mb-1 text-dark" href="${item.url}" data-page="${item.dataPage}">
                        <i class="fas fa-angle-right mr-2 text-primary"></i>${item.label}
                    </a>`;
            });
        }
        $("#sidebar-menu-target").html(sidebarMenuHTML);
    };

    const setActiveNavLink = () => {
        let path = window.location.pathname;
        let page = path.split("/").pop().replace(".html", "") || "index";
        $(`[data-page="${page}"]`).addClass('active text-primary');
    };

    /* =========================================
       4. KÖR PÅ START
       ========================================= */
    $(document).ready(function () {
        console.log("Document ready - kör initSite");
        initSite();

        // Scroll
        $(window).scroll(function () {
            if ($(this).scrollTop() > 100) {
                $('.back-to-top').fadeIn('slow');
            } else {
                $('.back-to-top').fadeOut('slow');
            }
        });

        $('.back-to-top').click(function () {
            $('html, body').animate({scrollTop: 0}, 1500, 'swing');
            return false;
        });

        // Karuseller
        if ($('#blog-carousel').length) $('#blog-carousel').carousel();
        if ($('#news-carousel').length) $('#news-carousel').carousel();
    });

})(jQuery);
