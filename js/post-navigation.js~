// post-navigation.js

console.log("post-navigation.js loaded");

// Funktion för att hämta blogginlägg från JSON-filen
async function getBlogPosts() {
    try {
        const response = await fetch('/blogg/json/blog_posts.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const posts = await response.json();
        console.log("Bloggposter:", posts); // Logga bloggposterna
        return posts;
    } catch (error) {
        console.error("Kunde inte ladda bloggposter:", error);
        return []; // Returnera en tom array om det uppstår ett fel
    }
}

// Funktion för att generera navigationen
async function generatePostNavigation() {
    const posts = await getBlogPosts();

    if (!posts || posts.length === 0) {
        console.warn("Inga bloggposter att visa.");
        return; // Avsluta funktionen om det inte finns några inlägg
    }

    // Hämta den aktuella sidans filnamn
    const currentFilename = window.location.pathname.split('/').pop();
    console.log("Aktuell fil:", currentFilename); // Logga aktuell fil

    // Hitta indexet för det aktuella blogginlägget i listan
    const currentIndex = posts.findIndex(post => {
        const linkFilename = post.link.split('/').pop(); // Extrahera filnamnet från post.link
        console.log(`Jämför ${linkFilename} med ${currentFilename}`);
        return linkFilename === currentFilename;
    });

    console.log("Aktuellt index:", currentIndex); // Logga aktuellt index

    // Hämta länkarna
    const prevLink = document.querySelector('.prev-post');
    const nextLink = document.querySelector('.next-post');

    if (!prevLink || !nextLink) {
        console.error("Kunde inte hitta .prev-post eller .next-post element");
        return;
    }

    if (currentIndex > 0) {
        // Det finns ett föregående inlägg
        const prevPost = posts[currentIndex - 1];
        prevLink.href =  prevPost.link;
        prevLink.textContent = "Föregående inlägg";
        prevLink.classList.remove('disabled');
    } else {
        // Inaktivera "Föregående inlägg"-länken
        prevLink.removeAttribute('href');
        prevLink.textContent = "Inget tidigare inlägg";
        prevLink.classList.add('disabled');
    }

    if (currentIndex < posts.length - 1) {
        // Det finns ett nästa inlägg
        const nextPost = posts[currentIndex + 1];
        nextLink.href = nextPost.link;
        nextLink.textContent = "Nästa inlägg";
        nextLink.classList.remove('disabled');
    } else {
        // Inaktivera "Nästa inlägg"-länken
        nextLink.removeAttribute('href');
        nextLink.textContent = "Inget nästa inlägg";
        nextLink.classList.add('disabled');
    }
}

// Kör funktionen när sidan laddas
window.addEventListener('load', generatePostNavigation);