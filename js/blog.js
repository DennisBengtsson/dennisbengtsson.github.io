// Delad funktion för att undvika XSS
function escapeHTML(str) {
    if (typeof str !== 'string' && !(str instanceof String)) {
        return "";
    }
    const p = document.createElement("p");
    p.textContent = str;
    return p.innerHTML;
}

// Funktion för att hämta bloggdata
async function fetchBlogData() {
    try {
        const response = await fetch('https://dennisbengtsson.github.io/json/blog_posts.json', {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP-fel: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Kunde inte ladda bloggdata:', error);
        return null;
    }
}

// Funktion för att skapa blogglistan
function createBlogList(blogPosts) {
    const blogList = document.getElementById('blog-list');
    if (!blogList || !Array.isArray(blogPosts)) return;

    blogList.innerHTML = '';

    blogPosts.forEach(post => {
        // Validera postdata
        const safePost = {
            title: escapeHTML(post.title || ''),
            description: escapeHTML(post.description || ''),
            image: escapeHTML(post.image || 'default-image.jpg'),
            date: escapeHTML(post.date || ''),
            category: escapeHTML(post.category || 'Okategoriserat'),
            comments: Number.isInteger(post.comments) ? post.comments : 0,
            link: escapeHTML(post.link || '#')
        };

        blogList.innerHTML += `
            <div class="row blog-item px-3 pb-5">
                <div class="col-md-5">
                    <img class="img-fluid mb-4 mb-md-0" src="${safePost.image}" alt="${safePost.title}">
                </div>
                <div class="col-md-7">
                    <h3 class="mt-md-4 px-md-3 mb-2 py-2 bg-white font-weight-bold">${safePost.title}</h3>
                    <div class="d-flex mb-3">
                        <small class="mr-2 text-muted"><i class="fa fa-calendar-alt"></i> ${safePost.date}</small>
                        <small class="mr-2 text-muted"><i class="fa fa-folder"></i> ${safePost.category}</small>
                        <small class="mr-2 text-muted"><i class="fa fa-comments"></i> ${safePost.comments} Kommentarer</small>
                    </div>
                    <p>${safePost.description}</p>
                    <a class="btn btn-sm btn-outline-primary next-post" href="${safePost.link}">Läs mer <i class="fa fa-angle-right"></i></a>
                </div>
            </div>
        `;
    });
}

// Funktion för att skapa karusell
function createCarousel(blogPosts) {
    const carouselInner = $('#carousel-inner');
    if (!carouselInner.length || !Array.isArray(blogPosts)) return;

    carouselInner.empty();

    try {
        // Filtrera ogiltiga poster och sortera efter datum
        const validPosts = blogPosts.filter(post => 
            post && post.date && new Date(post.date) !== "Invalid Date"
        );
        
        const latestPosts = validPosts
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        if (latestPosts.length === 0) {
            carouselInner.html('<div class="carousel-item active">Inga blogginlägg tillgängliga</div>');
            return;
        }

        latestPosts.forEach((post, index) => {
            const safePost = {
                title: escapeHTML(post.title || ''),
                description: escapeHTML(post.description || ''),
                image: escapeHTML(post.image || 'default-image.jpg'),
                link: escapeHTML(post.link || '#')
            };

            const carouselItem = $(`
                <div class="carousel-item${index === 0 ? ' active' : ''}">
                    <img src="${safePost.image}" class="d-block w-100" alt="${safePost.title}">
                    <div class="carousel-caption d-none d-md-block">
                        <h5>${safePost.title}</h5>
                        <p>${safePost.description}</p>
                        <a href="${safePost.link}" class="btn btn-primary custom-read-more-button">Läs mer</a>
                    </div>
                </div>
            `);
            
            carouselInner.append(carouselItem);
        });
    } catch (error) {
        console.error('Fel vid skapande av karusell:', error);
        carouselInner.html('<div class="carousel-item active">Kunde inte ladda blogginlägg</div>');
    }
}

// Initiera komponenter beroende på sidan
$(document).ready(async function() {
    const blogData = await fetchBlogData();
    
    if (window.location.pathname.includes("blog.html")) {
        createBlogList(blogData || []);
    }
    
    if (window.location.pathname.includes("index.html")) {
        createCarousel(blogData || []);
    }
});
