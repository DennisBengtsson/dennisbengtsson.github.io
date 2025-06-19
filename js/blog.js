// === Konfigurationsobjekt ===
const BlogConfig = {
    jsonUrl: '/json/blog_posts.json',
    defaultImage: 'default-image.jpg',
    defaultCategory: 'Okategoriserat',
    maxCarouselPosts: 5
};

// === Shared Utility Functions ===
if (typeof window.escapeHTML !== 'function') {
    window.escapeHTML = function(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };
}


const isValidDate = (dateString) => {
    const date = new Date(dateString);
    return date.toString() !== 'Invalid Date' && !isNaN(date.getTime());
};

// === Datahantering ===
async function fetchBlogData() {
    try {
        const response = await fetch(BlogConfig.jsonUrl, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Validera data direkt vid hämtning
        return Array.isArray(data) ? data.filter(post => 
            post && 
            post.title && 
            post.description && 
            isValidDate(post.date)
        ) : [];
    } catch (error) {
        console.error('Kunde inte ladda bloggdata:', error);
        return [];
    }
}

// === UI-komponenter ===
function createBlogPost(post) {
    const safePost = {
        title: escapeHTML(post.title || ''),
        description: escapeHTML(post.description || ''),
        image: escapeHTML(post.image || BlogConfig.defaultImage),
        date: escapeHTML(post.date || ''),
        category: escapeHTML(post.category || BlogConfig.defaultCategory),
        comments: Number.isInteger(post.comments) ? post.comments : 0,
        link: escapeHTML(post.link || '#')
    };

    return `
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
                <a class="btn btn-sm btn-outline-primary next-post" href="${safePost.link}">
                    Läs mer <i class="fa fa-angle-right"></i>
                </a>
            </div>
        </div>
    `;
}

function createCarouselItem(post, isActive = false) {
    const safePost = {
        title: escapeHTML(post.title || ''),
        description: escapeHTML(post.description || ''),
        image: escapeHTML(post.image || BlogConfig.defaultImage),
        link: escapeHTML(post.link || '#')
    };

    return `
        <div class="carousel-item${isActive ? ' active' : ''}">
            <img src="${safePost.image}" class="d-block w-100" alt="${safePost.title}">
            <div class="carousel-caption d-none d-md-block">
                <h5>${safePost.title}</h5>
                <p>${safePost.description}</p>
                <a href="${safePost.link}" class="btn btn-primary custom-read-more-button">Läs mer</a>
            </div>
        </div>
    `;
}

// === Huvudrenderare ===
function renderBlogList(blogPosts) {
    const blogList = document.getElementById('blog-list');
    if (!blogList || !Array.isArray(blogPosts)) return;

    // Skapa all HTML på en gång för bättre prestanda
    blogList.innerHTML = blogPosts
        .map(post => createBlogPost(post))
        .join('');
}

function renderCarousel(blogPosts) {
    const carouselInner = document.getElementById('carousel-inner');
    if (!carouselInner || !Array.isArray(blogPosts)) return;

    // Filtrera, sortera och ta de senaste inläggen
    const validPosts = blogPosts
        .filter(post => isValidDate(post.date))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, BlogConfig.maxCarouselPosts);

    if (validPosts.length === 0) {
        carouselInner.innerHTML = '<div class="carousel-item active">Inga blogginlägg tillgängliga</div>';
        return;
    }

    // Skapa alla karusellposter
    carouselInner.innerHTML = validPosts
        .map((post, index) => createCarouselItem(post, index === 0))
        .join('');
}

// === Initiering ===
$(document).ready(async function() {
    // Hämta data endast en gång
    const blogData = await fetchBlogData();
    
    // Initiera komponenter beroende på sidan
    const path = window.location.pathname;
    
    if (path.includes("blog.html")) {
        renderBlogList(blogData);
    }
    
    if (path.includes("index.html")) {
        renderCarousel(blogData);
    }
});
