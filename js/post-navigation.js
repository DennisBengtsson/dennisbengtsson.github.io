/**
 * Post Navigation System
 * @author Dennis Bengtsson
 * @version 1.0.0
 */

console.log("post-navigation.js loaded");

// Konfigurationsobjekt för enkel anpassning
const NavigationConfig = {
    jsonPath: '/json/blog_posts.json',
    prevSelector: '.prev-post',
    nextSelector: '.next-post',
    debug: true
};

// Utility functions
const debugLog = (...args) => {
    if (NavigationConfig.debug) console.log(...args);
};

const getFileNameFromPath = (path) => {
    return path.split('/').pop().toLowerCase();
};

// Hämta bloggposter med memoization
const blogPostCache = {
    data: null,
    isLoading: false,
    async getPosts() {
        if (this.data) return this.data;
        if (this.isLoading) return new Promise(resolve => {
            const checkData = () => {
                if (this.data) resolve(this.data);
                else setTimeout(checkData, 50);
            };
            checkData();
        });

        this.isLoading = true;
        try {
            const response = await fetch(NavigationConfig.jsonPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            this.data = data;
            this.isLoading = false;
            return data;
        } catch (error) {
            console.error("Kunde inte ladda bloggposter:", error);
            this.isLoading = false;
            return [];
        }
    }
};

// Huvudfunktion för navigation
async function generatePostNavigation() {
    try {
        // Hämta data och aktuell sida
        const posts = await blogPostCache.getPosts();
        debugLog("Bloggposter:", posts);
        
        if (!posts.length) {
            console.warn("Inga bloggposter att visa.");
            return;
        }

        const currentFilename = getFileNameFromPath(window.location.pathname);
        debugLog("Aktuell fil:", currentFilename);

        // Hitta aktuell post med optimerad sökning
        const currentIndex = posts.findIndex(post => {
            const linkFilename = getFileNameFromPath(post.link);
            debugLog(`Jämför ${linkFilename} med ${currentFilename}`);
            return linkFilename === currentFilename;
        });

        debugLog("Aktuellt index:", currentIndex);
        if (currentIndex === -1) return;

        // Hämta navigeringslänkar
        const prevLink = document.querySelector(NavigationConfig.prevSelector);
        const nextLink = document.querySelector(NavigationConfig.nextSelector);

        if (!prevLink || !nextLink) {
            console.error("Kunde inte hitta navigeringslänkar");
            return;
        }

        debugLog("Navigeringslänkar hittade");

        // Uppdatera länkar
        updateNavigationLink(prevLink, posts[currentIndex - 1], currentIndex > 0);
        updateNavigationLink(nextLink, posts[currentIndex + 1], currentIndex < posts.length - 1);
        
    } catch (error) {
        console.error("Fel i postnavigering:", error);
    }
}

// Uppdaterar en navigeringslänk
function updateNavigationLink(linkElement, nextPost, isEnabled) {
    if (isEnabled && nextPost) {
        linkElement.href = nextPost.link;
        linkElement.textContent = linkElement.classList.contains('prev-post') ? 
            "Föregående inlägg" : "Nästa inlägg";
        linkElement.classList.remove('disabled');
        linkElement.removeAttribute('aria-disabled');
        linkElement.removeAttribute('tabindex');
    } else {
        linkElement.removeAttribute('href');
        linkElement.textContent = linkElement.classList.contains('prev-post') ? 
            "Inget tidigare inlägg" : "Inget nästa inlägg";
        linkElement.classList.add('disabled');
        linkElement.setAttribute('aria-disabled', 'true');
        linkElement.setAttribute('tabindex', '-1');
    }
}

// Initiera navigation
document.addEventListener('DOMContentLoaded', () => {
    // Låt sidan ladda först, sedan kör navigationen
    requestIdleCallback(generatePostNavigation, { timeout: 2000 });
});
