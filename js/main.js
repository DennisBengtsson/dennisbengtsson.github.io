(function ($) {
    "use strict";

    console.log("Main.js har startat...");

    /* =========================================
       1. HTML-MALLAR (Din "bra" kod)
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
                        <a class="btn btn-outline-primary mr-2" href="#" target="_blank" id="telegram-link"><i class="fab fa-telegram"></i></a>
                        <a class="btn btn-outline-primary mr-2" href="#" target="_blank" id="goodreads-link"><i class="fab fa-goodreads"></i></a>
                        <a class="btn btn-outline-primary mr-2" href="#" target="_blank" id="linkedin-link"><i class="fab fa-linkedin-in"></i></a>
                        <a class="btn btn-outline-primary mr-2" href="#" target="_blank" id="instagram-link"><i class="fab fa-instagram"></i></a>
                    </div>
                    
                    <a href="mailto:dennisrmgbengtsson@gmail.com" class="btn btn-lg btn-block btn-primary mt-auto">Kontakta mig</a>
                </div>
            </div>
            
            <div class="sidebar-icon d-flex flex-column h-100 justify-content-center text-right">
                <i class="fas fa-2x fa-angle-double-right text-primary"></i>
            </div>
        </div>
    `;

    const footerHTML = `
        <div class="container py-4 bg-secondary text-center">
            <p class="m-0 text-white fs-5">
                &copy; 2025 <span id="footer-name">Dennis Bengtsson</span>. Ingen datainsamling. Alla rättigheter förbehållna.
                </p>
        </div>
    `;

    /* =========================================
       2. DATA (BACKUP)
       ========================================= */
    const fallbackData = {
        name: "Dennis Bengtsson",
        description: "Certifierad snickare och betongarbetare.",
        pageTitleSuffix: " - Personlig Blogg",
        sidebar: { profileImagePath: "img/profile.jpg" },
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
        // Injicera HTML
        $("#header-container").html(headerHTML);
        $("#sidebar-container").html(sidebarHTML);
        $("#footer-container").html(footerHTML);

        let data = fallbackData;

        // Försök hämta JSON
        try {
            const response = await fetch('data.json');
            if (response.ok) {
                data = await response.json();
            } else {
                console.warn("Kunde inte ladda data.json, använder backup.");
            }
        } catch (error) {
            console.warn("Fetch error:", error);
        }

        // Kör uppdateringar
        updatePageContent(data);
        generateMenu(data.menu);
        setActiveNavLink();
    };

    const updatePageContent = (data) => {
        // Sidtitel
        if (document.getElementById('page-title')) {
            document.getElementById('page-title').textContent = data.name + (data.pageTitleSuffix || '');
        }

        // Sidebar & Footer texter
        $("#profile-name").text(data.name);
        $("#footer-name").text(data.name);
        $("#profile-description").text(data.description);

        // Sidebar Bild
        const imgPath = (data.sidebar && data.sidebar.profileImagePath) ? data.sidebar.profileImagePath : "img/about.jpg";
        $("#profile-image").attr("src", imgPath);

        // Länkar
        $("#telegram-link").attr("href", data.telegram || "#");
        $("#goodreads-link").attr("href", data.goodreads || "#");
        $("#linkedin-link").attr("href", data.linkedin || "#");
        $("#instagram-link").attr("href", data.instagram || "#");
    };

    const generateMenu = (menuItems) => {
        let menuHTML = '';
        
        if (menuItems) {
            menuItems.forEach(item => {
                if (item.dropdown) {
                    // Om det är en dropdown
                    menuHTML += `
                        <div class="nav-item dropdown">
                            <a href="#" class="nav-link dropdown-toggle" data-toggle="dropdown">${item.label}</a>
                            <div class="dropdown-menu">
                    `;
                    item.dropdown.forEach(subItem => {
                        menuHTML += `<a href="${subItem.url}" class="dropdown-item" data-page="${subItem.dataPage}">${subItem.label}</a>`;
                    });
                    menuHTML += `</div></div>`;
                } else {
                    // Vanlig länk
                    menuHTML += `<a href="${item.url}" class="nav-item nav-link" data-page="${item.dataPage}">${item.label}</a>`;
                }
            });
        }

        // Placera menyn i Headern (inte sidebaren, enligt din design)
        $("#header-menu-target").html(menuHTML);
    };

    const setActiveNavLink = () => {
        let path = window.location.pathname;
        let page = path.split("/").pop().replace(".html", "") || "index";
        
        // Nollställ och sätt aktiv klass
        $('.nav-link, .dropdown-item').removeClass('active');
        $(`[data-page="${page}"]`).addClass('active');
        
        // Om det är en dropdown-item, gör även föräldern aktiv
        $(`[data-page="${page}"]`).closest('.dropdown').find('.dropdown-toggle').addClass('active');
    };

    /* =========================================
       4. KÖR VID START
       ========================================= */
    $(document).ready(function () {
        initSite();

        // Scroll-knapp funktioner
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

        // Starta eventuella karuseller
        if ($('#blog-carousel').length) $('#blog-carousel').carousel();
        if ($('#news-carousel').length) $('#news-carousel').carousel();
    });

})(jQuery);
