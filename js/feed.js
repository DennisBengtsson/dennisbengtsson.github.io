// js/feed.js

function loadNewsCarousel() {
    // URL till RSS-flödet och Proxy
    const rssUrl = 'https://www.byggvarlden.se/feed/';
    const proxyUrl = 'https://api.allorigins.win/get?url=';

    // Hämta data
    $.getJSON(proxyUrl + encodeURIComponent(rssUrl), function(data) {
        if (!data || !data.contents) {
            console.error("Ingen data mottogs från RSS-flödet.");
            return;
        }

        // Parsa XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data.contents, "text/xml");
        const items = xmlDoc.querySelectorAll("item");
        const carouselInner = document.getElementById('news-carousel-inner');

        // Töm beh��llaren på "Laddar..."-texten
        carouselInner.innerHTML = '';

        let count = 0;
        
        // Loopa genom de 5 senaste nyheterna
        items.forEach((item) => {
            if (count >= 5) return;

            const title = item.querySelector("title") ? item.querySelector("title").textContent : "Nyhet";
            const link = item.querySelector("link") ? item.querySelector("link").textContent : "#";
            
            // --- BILDHANTERING ---
            // Sätt en standardbild om ingen hittas i flödet
            // VIKTIGT: Se till att du har en bild som heter 'default-news.jpg' i din img-mapp!
            let imageUrl = 'img/default-news.jpg'; 
            
            // 1. Leta efter <enclosure> (Vanligast)
            const enclosure = item.querySelector("enclosure");
            if (enclosure && enclosure.getAttribute("url")) {
                imageUrl = enclosure.getAttribute("url");
            } 
            // 2. Leta efter media:content
            else if (item.getElementsByTagNameNS("*", "content").length > 0) {
                 const mediaCheck = item.getElementsByTagNameNS("*", "content")[0].getAttribute("url");
                 if(mediaCheck) imageUrl = mediaCheck;
            }
            // 3. Leta inuti beskrivningen (HTML)
            else {
                const description = item.querySelector("description") ? item.querySelector("description").textContent : "";
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = description;
                const imgInDesc = tempDiv.querySelector("img");
                if (imgInDesc) {
                    imageUrl = imgInDesc.src;
                }
            }

            // Sätt 'active' på den första sliden för att Bootstrap ska visa den
            const isActive = count === 0 ? 'active' : '';

            // Skapa HTML-strukturen
            const carouselItem = `
                <div class="carousel-item ${isActive}">
                    <div class="container py-5">
                        <div class="row justify-content-center">
                            <div class="col-md-8">
                                <div class="card shadow border-0" style="min-height: 400px;">
                                    <div style="height: 250px; overflow: hidden; background-color: #333;">
                                        <img src="${imageUrl}" class="card-img-top" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='img/default-news.jpg'">
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

        // --- STARTA KARUSELLEN ---
        // Vi initierar karusellen manuellt HÄR, efter att bilderna lagts till i DOM:en
        $('#news-carousel').carousel({
            interval: 5000, // Tid i millisekunder (5 sekunder)
            pause: "hover"  // Pausa när musen hålls över
        });

    }).fail(function() {
        // Felhantering
        document.getElementById('news-carousel-inner').innerHTML = `
            <div class="carousel-item active">
                <div class="container py-5 text-center">
                    <div class="alert alert-warning">
                        Kunde inte hämta nyheter just nu. (Kontrollera internetuppkoppling eller brandvägg)
                    </div>
                </div>
            </div>
        `;
    });
}

// Kör funktionen när sidan (och jQuery) är redo
$(document).ready(function() {
    loadNewsCarousel();
});
