// js/feed.js - Hanterar flera RSS-flöden via rss2json

function loadNewsCarousel() {
    // Lista med dina RSS-flöden
    const rssUrls = [
        'https://www.byggvarlden.se/feed/',
        'https://www.byggindustrin.se/rss.xml'
    ];

    // Skapa en "promise" för varje URL (vi hämtar alla samtidigt)
    const requests = rssUrls.map(url => {
        const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url);
        return $.getJSON(apiUrl);
    });

    // När alla hämtningar är klara (Promise.all)
    Promise.all(requests).then(results => {
        let allItems = [];

        // Gå igenom resultaten från varje flöde
        results.forEach(data => {
            if (data.status === 'ok' && data.items) {
                allItems = allItems.concat(data.items);
            }
        });

        // Sortera alla nyheter efter publiceringsdatum (nyast först)
        allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        // Vi tar bara de 5 senaste totalt (från blandade källor)
        const topNews = allItems.slice(0, 5);

        const carouselInner = document.getElementById('news-carousel-inner');
        carouselInner.innerHTML = '';

        if (topNews.length === 0) {
            console.error("Inga nyheter hittades.");
            return;
        }

        let count = 0;

        // Loopa genom de sorterade och blandade nyheterna
        topNews.forEach((item) => {
            const title = item.title;
            const link = item.link;
            
            // --- BILDHANTERING (Samma logik som du hade) ---
            let imageUrl = item.thumbnail || item.enclosure?.link || '';

            if (!imageUrl) {
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = item.content || item.description;
                const imgInDesc = tempDiv.querySelector("img");
                if (imgInDesc) {
                    imageUrl = imgInDesc.src;
                }
            }

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
                                        <img src="${imageUrl}" class="card-img-top" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='img/senaste.jpg';">
                                    </div>
                                    <div class="card-body text-center d-flex flex-column justify-content-between">
                                        <h5 class="card-title font-weight-bold">${title}</h5>
                                        <small class="text-muted mb-2">${new Date(item.pubDate).toLocaleDateString('sv-SE')}</small>
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

    }).catch(function(error) {
        console.log("Kunde inte nå API:et eller fel i data.", error);
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
