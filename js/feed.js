// js/feed.js - Använder rss2json.com för bättre stabilitet

function loadNewsCarousel() {
    // Vi använder rss2json som konverterar RSS till JSON och hanterar CORS automatiskt
    const rssUrl = 'https://www.byggvarlden.se/feed/';
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rssUrl);

    $.getJSON(apiUrl, function(data) {
        // Kontrollera att status är ok
        if (data.status !== 'ok' || !data.items) {
            console.error("Kunde inte hämta RSS-flödet.");
            return;
        }

        const items = data.items;
        const carouselInner = document.getElementById('news-carousel-inner');

        // Töm behållaren
        carouselInner.innerHTML = '';

        let count = 0;

        // Loopa genom nyheterna
        items.forEach((item) => {
            if (count >= 5) return; // Max 5 nyheter

            const title = item.title;
            const link = item.link;
            
            // --- BILDHANTERING ---
            // rss2json försöker hitta en thumbnail automatiskt ('enclosure' eller 'thumbnail')
            let imageUrl = item.thumbnail || item.enclosure.link || '';

            // Om rss2json inte hittade en bild, leta i innehållstexten (description/content)
            if (!imageUrl) {
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = item.content || item.description;
                const imgInDesc = tempDiv.querySelector("img");
                if (imgInDesc) {
                    imageUrl = imgInDesc.src;
                }
            }

            // Fallback om ingen bild hittas alls
            if (!imageUrl) {
                imageUrl = 'img/senaste.jpg';
            }

            const isActive = count === 0 ? 'active' : '';

            // Skapa HTML
            const carouselItem = `
                <div class="carousel-item ${isActive}">
                    <div class="container py-5">
                        <div class="row justify-content-center">
                            <div class="col-md-8">
                                <div class="card shadow border-0" style="min-height: 400px;">
                                    <div style="height: 250px; overflow: hidden; background-color: #333;">
                                        <img src="${imageUrl}" class="card-img-top" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='img/senaste.jpg
                                    </div>
                                    <div class="card-body text-center d-flex flex-column justify-content-between">
                                        <h5 class="card-title font-weight-bold">${title}</h5>
                                        <div>
                                            <a href="${link}" target="_blank" rel="noopener" class="btn btn-primary mt-2">Läs hela artikeln</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            carouselInner.innerHTML += carouselItem;
            count++;
        });

        // Starta karusellen
        $('#news-carousel').carousel({
            interval: 5000,
            pause: "hover"
        });

    }).fail(function() {
        console.log("Kunde inte nå API:et.");
        document.getElementById('news-carousel-inner').innerHTML = `
            <div class="carousel-item active">
                <div class="container py-5 text-center">
                    <div class="alert alert-warning">
                        Kunde inte hämta nyheter just nu.
                    </div>
                </div>
            </div>
        `;
    });
}

$(document).ready(function() {
    loadNewsCarousel();
});
