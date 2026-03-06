// js/feed.js - Hanterar flera RSS-flöden via rss2json

function loadNewsCarousel() {
    const rssUrls = [
        '',
        '',
        ''
    ];

    const requests = rssUrls.map(url => {
        const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url);
        return $.getJSON(apiUrl);
    });

    // allSettled fortsätter även om ett flöde misslyckas
    Promise.allSettled(requests).then(results => {
        let allItems = [];

        // Plocka bara lyckade svar
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.status === 'ok') {
                allItems = allItems.concat(result.value.items);
            }
        });

        // Sortera nyast först
        allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        const topNews = allItems.slice(0, 5);
        const carouselInner = document.getElementById('news-carousel-inner');
        carouselInner.innerHTML = '';

        if (topNews.length === 0) {
            carouselInner.innerHTML = `
                <div class="carousel-item active">
                    <div class="container py-5 text-center">
                        <div class="alert alert-warning">Kunde inte hämta nyheter just nu.</div>
                    </div>
                </div>`;
            return;
        }

        topNews.forEach((item, count) => {
            let imageUrl = item.thumbnail || item.enclosure?.link || '';

            if (!imageUrl) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = item.content || item.description;
                const imgInDesc = tempDiv.querySelector('img');
                if (imgInDesc) imageUrl = imgInDesc.src;
            }

            if (!imageUrl) imageUrl = 'img/senaste.jpg';

            const isActive = count === 0 ? 'active' : '';

            carouselInner.innerHTML += `
                <div class="carousel-item ${isActive}">
                    <div class="container py-5">
                        <div class="row justify-content-center">
                            <div class="col-md-8">
                                <div class="card shadow border-0" style="min-height: 400px;">
                                    <div style="height: 250px; overflow: hidden; background-color: #333;">
                                        <img src="${imageUrl}" class="card-img-top" alt="${item.title}"
                                             style="width:100%;height:100%;object-fit:cover;"
                                             onerror="this.src='img/senaste.jpg'">
                                    </div>
                                    <div class="card-body text-center d-flex flex-column justify-content-between">
                                        <h5 class="card-title font-weight-bold">${item.title}</h5>
                                        <small class="text-muted mb-2">${new Date(item.pubDate).toLocaleDateString('sv-SE')}</small>
                                        <a href="${item.link}" target="_blank" rel="noopener" class="btn btn-primary mt-2">Läs hela artikeln</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        // Förstör den gamla instansen innan ny startas
        $('#news-carousel').carousel('dispose');
        $('#news-carousel').carousel({ interval: 5000, pause: 'hover' });
    });
}

$(document).ready(function () {
    loadNewsCarousel();
});