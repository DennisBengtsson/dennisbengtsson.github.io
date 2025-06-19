// Utility functions
const escapeHTML = (str) => {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

const updateElement = (elementId, updater, value) => {
    const element = document.getElementById(elementId);
    if (element) {
        if (updater === 'text') element.textContent = escapeHTML(value);
        else if (updater === 'html') element.innerHTML = escapeHTML(value);
        else if (updater === 'href') element.setAttribute('href', escapeHTML(value));
    }
};

// Component HTML
const headerHTML = `
    <nav class="navbar navbar-expand-lg bg-secondary navbar-dark">
        <a href="index.html" class="navbar-brand d-block d-lg-none">Navigering</a>
        <button type="button" class="navbar-toggler" data-toggle="collapse" data-target="#navbarCollapse">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse justify-content-between" id="navbarCollapse">
            <div class="navbar-nav m-auto" id="navbar-menu">
                <!-- Menu will be injected here -->
            </div>
        </div>
    </nav>
`;

const footerHTML = `
  <div class="container py-4 bg-secondary text-center my-website-footer">
    <p class="m-0 text-white">
      &copy; 2025 <span id="footer-name"></span>. Alla rättigheter förbehållna.
    </p>
  </div>
`;

const sidebarHTML = `
    <div class="sidebar">
        <div class="sidebar-text d-flex flex-column h-100 justify-content-center text-center">
            <img class="mx-auto d-block w-75 bg-primary img-fluid rounded-circle mb-4 p-3" 
                 src="" alt="" id="profile-image">
            <h1 class="font-weight-bold" id="profile-name"></h1>
            <p class="mb-4" id="profile-description"></p>
            <div class="d-flex justify-content-center mb-5" id="social-links">
                <!-- Social links will be injected here -->
            </div>
            <a href="mailto:dennisrmgbengtsson@gmail.com" 
               class="btn btn-lg btn-block btn-primary mt-auto">Kontakta mig</a>
        </div>
        <div class="sidebar-icon d-flex flex-column h-100 justify-content-center text-right">
            <i class="fas fa-2x fa-angle-double-right text-primary"></i>
        </div>
    </div>
`;

// Data loading
const fetchData = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Data fetching error:', error);
        return null;
    }
};

// Component updates
const updatePageTitle = (data) => {
    const pageTitleElement = document.getElementById('page-title');
    if (pageTitleElement) {
        pageTitleElement.textContent = `${escapeHTML(data.name)}${escapeHTML(data.pageTitleSuffix || '')}`;
    }
};

const updateFooter = (data) => {
    updateElement(data.footerNameId, 'text', data.name);
};

const updateSidebar = (data) => {
    const sidebar = data.sidebar || {};
    
    // Update profile info
    updateElement(sidebar.profileNameId, 'text', data.name);
    updateElement(sidebar.profileDescriptionId, 'text', data.description);
    
    // Update profile image
    if (sidebar.profileImageId) {
        const profileImage = document.getElementById(sidebar.profileImageId);
        if (profileImage) {
            profileImage.src = escapeHTML(sidebar.profileImagePath || "/img/profile.jpg");
            profileImage.alt = escapeHTML(data.name || 'Profilbild');
        }
    }
    
    // Update social links
    const socialContainer = document.getElementById('social-links');
    if (socialContainer && data.socialLinks) {
        const fragment = document.createDocumentFragment();
        
        data.socialLinks.forEach(link => {
            if (link.url && link.icon) {
                const anchor = document.createElement('a');
                anchor.className = 'btn btn-outline-primary mr-2';
                anchor.href = escapeHTML(link.url);
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
                
                const icon = document.createElement('i');
                icon.className = escapeHTML(link.icon);
                anchor.appendChild(icon);
                
                fragment.appendChild(anchor);
            }
        });
        
        socialContainer.innerHTML = '';
        socialContainer.appendChild(fragment);
    }
};

// Menu generation
const generateMenu = (menuData) => {
    const fragment = document.createDocumentFragment();
    
    menuData.forEach(item => {
        if (item.dropdown) {
            // Create dropdown menu
            const dropdownDiv = document.createElement('div');
            dropdownDiv.className = 'nav-item dropdown';
            
            const toggleLink = document.createElement('a');
            toggleLink.className = 'nav-link dropdown-toggle';
            toggleLink.href = '#';
            toggleLink.setAttribute('data-toggle', 'dropdown');
            toggleLink.textContent = escapeHTML(item.label);
            
            const dropdownMenu = document.createElement('div');
            dropdownMenu.className = 'dropdown-menu';
            
            item.dropdown.forEach(dropdownItem => {
                const dropdownLink = document.createElement('a');
                dropdownLink.className = 'dropdown-item';
                dropdownLink.setAttribute('data-page', escapeHTML(dropdownItem.dataPage || ''));
                dropdownLink.href = escapeHTML(dropdownItem.url || '#');
                dropdownLink.textContent = escapeHTML(dropdownItem.label || '');
                
                dropdownMenu.appendChild(dropdownLink);
            });
            
            dropdownDiv.appendChild(toggleLink);
            dropdownDiv.appendChild(dropdownMenu);
            fragment.appendChild(dropdownDiv);
        } else {
            // Create regular link
            const link = document.createElement('a');
            link.className = 'nav-item nav-link';
            link.setAttribute('data-page', escapeHTML(item.dataPage || ''));
            link.href = escapeHTML(item.url || '#');
            link.textContent = escapeHTML(item.label || '');
            
            fragment.appendChild(link);
        }
    });
    
    return fragment;
};

// Navigation
const setActiveNavLink = () => {
    const path = window.location.pathname;
    const page = path.split("/").pop().replace(".html", "") || "index";
    
    document.querySelectorAll('.nav-link').forEach(link => {
        const linkPage = link.getAttribute('data-page');
        if (linkPage === page) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Inject components
    document.getElementById('header-container').innerHTML = headerHTML;
    document.getElementById('sidebar-container').innerHTML = sidebarHTML;
    document.getElementById('footer-container').innerHTML = footerHTML;

    // Load data
    const data = await fetchData('/data.json');
    if (!data) return;

    // Update components with data
    updatePageTitle(data);
    updateFooter(data);
    updateSidebar(data);

    // Generate and inject menu
    const navbarMenu = document.getElementById('navbar-menu');
    if (navbarMenu && data.menu) {
        navbarMenu.innerHTML = ''; // Clear loading content
        navbarMenu.appendChild(generateMenu(data.menu));
    }

    // Set active navigation
    setActiveNavLink();
});
