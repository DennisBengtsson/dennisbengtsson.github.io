
document.addEventListener('DOMContentLoaded', () => {
    // Justera länken "Tillbaka till bloggen"
    const backToBlogLink = document.querySelector('.btn.btn-link.p-0');
    if (backToBlogLink) {
        backToBlogLink.href = "/blog.html";
    }

    // Justera länkar för "Föregående inlägg" och "Nästa inlägg"
    const prevPostLink = document.querySelector('.prev-post');
    const nextPostLink = document.querySelector('.next-post');
    if (prevPostLink) {
        prevPostLink.href = "/blog/post1.html";
    }
    if (nextPostLink) {
        nextPostLink.href = "/blog/post2.html";
    }
    if (prevPostLink) {
        prevPostLink.href = "/blog/post3.html";
    }
    if (nextPostLink) {
        nextPostLink.href = "/blog/post4.html";
    }
});
