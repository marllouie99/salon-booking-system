// Load Navbar Component Dynamically

async function loadNavbarComponent() {
    try {
        const response = await fetch('/components/navbar.html');
        const html = await response.text();
        
        // Insert navbar at the beginning of body
        const navbarContainer = document.createElement('div');
        navbarContainer.innerHTML = html;
        document.body.insertBefore(navbarContainer.firstElementChild, document.body.firstChild);
        
        // Load navbar JavaScript
        const script = document.createElement('script');
        script.src = '/components/navbar.js';
        document.head.appendChild(script);
        
    } catch (error) {
        console.error('Error loading navbar:', error);
    }
}

// Auto-load navbar if not already present
if (!document.querySelector('.navbar')) {
    loadNavbarComponent();
}
