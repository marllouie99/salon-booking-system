// Ensure API_BASE_URL is defined (fallback if config.js hasn't loaded yet)
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'https://web-production-e6265.up.railway.app';
    console.warn('⚠️ API_BASE_URL was undefined in customer-home.js, using fallback:', window.API_BASE_URL);
}

// Global variables
let availableCities = [];
let isFiltersPanelOpen = false;

// Load user data on page load
document.addEventListener('DOMContentLoaded', function() {
    loadUserData();
    loadMockData();
    loadFeaturedSalons();
    initializeSearch();
    checkProfileCompletion();
    
    // Check if redirected with apply-salon hash
    if (window.location.hash === '#apply-salon') {
        setTimeout(() => {
            const userData = JSON.parse(localStorage.getItem('user_data'));
            if (userData && userData.user_type !== 'salon_owner') {
                showSalonApplicationModal();
            }
            // Remove hash from URL
            history.replaceState(null, null, ' ');
        }, 500);
    }
});

// Load user data from localStorage
function loadUserData() {
    console.log('🏠 Customer home page loaded');
    const userData = JSON.parse(localStorage.getItem('user_data'));
    console.log('📦 User data from localStorage:', userData);
    
    if (userData) {
        const firstName = userData.first_name || 'User';
        
        // Safely update user name elements
        const userNameEl = document.getElementById('userName');
        const welcomeNameEl = document.getElementById('welcomeName');
        
        if (userNameEl) userNameEl.textContent = firstName;
        if (welcomeNameEl) welcomeNameEl.textContent = firstName;
        
        // Check if user is a salon owner
        if (userData.user_type === 'salon_owner') {
            updateSalonButton('owner');
        }
    } else {
        console.warn('⚠️ No user data found immediately, waiting 700ms...');
        // Graceful fallback: wait briefly and retry once without redirecting away
        setTimeout(() => {
            const retryUserData = JSON.parse(localStorage.getItem('user_data'));
            if (retryUserData) {
                console.log('✅ User data found on retry, reloading page');
                window.location.reload();
            } else {
                console.error('❌ User data still not found after retry. Staying on page.');
            }
        }, 700);
    }
}

// Update salon button based on user type
function updateSalonButton(type) {
    const btn = document.getElementById('salonActionBtn');
    const btnText = document.getElementById('salonBtnText');
    // Navbar may not be injected yet; safely bail out
    if (!btn || !btnText) return;
    const btnIcon = btn.querySelector('i');
    
    if (type === 'owner') {
        btnText.textContent = 'Manage My Salon';
        if (btnIcon) btnIcon.className = 'fas fa-cog';
        btn.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
        btn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
    }
}

// Check if user profile is complete
function checkProfileCompletion() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    
    console.log('Checking profile completion...');
    console.log('User data:', userData);
    
    if (!userData) {
        console.log('No user data found');
        return;
    }
    
    // Check if user dismissed the banner in this session
    const dismissed = sessionStorage.getItem('profileWarningDismissed');
    console.log('Banner dismissed:', dismissed);
    if (dismissed === 'true') return;
    
    // Check which fields are missing
    const missingFields = [];
    if (!userData.first_name) missingFields.push('First Name');
    if (!userData.last_name) missingFields.push('Last Name');
    if (!userData.phone) missingFields.push('Phone Number');
    if (!userData.address) missingFields.push('Address');
    
    const isIncomplete = missingFields.length > 0;
    
    console.log('Profile incomplete:', isIncomplete);
    console.log('Missing fields:', missingFields);
    
    if (isIncomplete) {
        const banner = document.getElementById('profileWarningBanner');
        const missingFieldsSpan = document.getElementById('missingFields');
        
        console.log('Banner element:', banner);
        
        if (banner && missingFieldsSpan) {
            // Update banner text to show missing fields
            const fieldsList = missingFields.join(', ');
            missingFieldsSpan.textContent = fieldsList;
            
            banner.style.display = 'block';
            console.log('✓ Banner shown with missing fields:', fieldsList);
        } else {
            console.error('✗ Banner element not found in DOM');
        }
    } else {
        console.log('Profile is complete, no banner needed');
    }
}

// Close warning banner
function closeWarningBanner() {
    const banner = document.getElementById('profileWarningBanner');
    if (banner) {
        banner.style.display = 'none';
        // Remember dismissal for this session
        sessionStorage.setItem('profileWarningDismissed', 'true');
    }
}

// Handle salon action button click
function handleSalonAction() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    
    if (userData && userData.user_type === 'salon_owner') {
        // Redirect to salon management page
        window.location.href = '/salon/dashboard';
    } else {
        // Show application modal
        showSalonApplicationModal();
    }
}

// Load mock data for demonstration
function loadMockData() {
    // Mock stats
    const totalBookingsEl = document.getElementById('totalBookings');
    const upcomingBookingsEl = document.getElementById('upcomingBookings');
    const favoriteSalonsEl = document.getElementById('favoriteSalons');
    const rewardsEl = document.getElementById('rewards');
    
    if (totalBookingsEl) totalBookingsEl.textContent = '12';
    if (upcomingBookingsEl) upcomingBookingsEl.textContent = '2';
    if (favoriteSalonsEl) favoriteSalonsEl.textContent = '5';
    if (rewardsEl) rewardsEl.textContent = '340';
}

// Load featured salons from API
async function loadFeaturedSalons() {
    try {
        const response = await fetch(`${window.API_BASE_URL}/api/salons/`);
        
        if (response.ok) {
            const salons = await response.json();
            console.log('Loaded salons:', salons);
            displayFeaturedSalons(salons);
        } else {
            console.error('Failed to load salons');
            showNotification('Failed to load salons', 'error');
        }
    } catch (error) {
        console.error('Error loading salons:', error);
        showNotification('Network error loading salons', 'error');
    }
}

// Display featured salons in the grid
function displayFeaturedSalons(salons) {
    const salonsGrid = document.getElementById('featuredSalons');
    
    // Store globally for booking
    window.currentSalonsData = salons;
    
    if (!salonsGrid) {
        // Element not on this page - silently skip
        return;
    }
    
    if (!salons || salons.length === 0) {
        salonsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <i class="fas fa-store-slash" style="font-size: 3rem; color: #cbd5e0; margin-bottom: 1rem;"></i>
                <h3 style="color: #64748b;">No salons available yet</h3>
                <p style="color: #94a3b8;">Be the first to apply and join our platform!</p>
            </div>
        `;
        return;
    }
    
    // Display salons (limit to 6 for featured section)
    const featuredSalons = salons.slice(0, 6);
    
    salonsGrid.innerHTML = featuredSalons.map(salon => {
        // Handle rating display
        const rating = salon.rating > 0 ? salon.rating : 0;
        const ratingText = rating > 0 ? `${rating.toFixed(1)} (${salon.total_reviews} reviews)` : 'New Salon';
        
        // Handle description
        const description = salon.description ? 
            (salon.description.length > 100 ? salon.description.substring(0, 100) + '...' : salon.description) : 
            'Professional salon services';
            
        // Handle services - convert from database format to display
        let servicesHtml = '';
        if (salon.services && Array.isArray(salon.services) && salon.services.length > 0) {
            servicesHtml = salon.services.slice(0, 3).map(service => 
                `<span class="service-tag">${service}</span>`
            ).join('');
            if (salon.services.length > 3) {
                servicesHtml += `<span class="service-more">+${salon.services.length - 3} more</span>`;
            }
        } else {
            // If no services in the salon model, show placeholder
            servicesHtml = '<span class="service-tag">Hair Services</span><span class="service-tag">Beauty</span>';
        }
        
        // Handle cover image - use salon's cover_image if available, otherwise use placeholder
        const coverImage = salon.cover_image 
            ? `${window.API_BASE_URL}${salon.cover_image}` 
            : 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=250&fit=crop';
        
        // Handle logo - use salon's logo if available, otherwise use placeholder
        const logoImage = salon.logo 
            ? `${window.API_BASE_URL}${salon.logo}` 
            : 'https://via.placeholder.com/80x80?text=' + encodeURIComponent(salon.name.charAt(0));
        
        return `
        <div class="salon-card" onclick="openBookingModal(${salon.id})">
            <div class="salon-image">
                <img src="${coverImage}" alt="${salon.name}" onerror="this.src='https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=250&fit=crop'">
                ${salon.is_verified ? '<div class="salon-badge verified">Verified</div>' : ''}
                <button class="favorite-btn" onclick="event.stopPropagation(); toggleFavorite(${salon.id})">
                    <i class="far fa-heart"></i>
                </button>
                <div class="salon-logo">
                    <img src="${logoImage}" alt="${salon.name} logo" onerror="this.src='https://via.placeholder.com/80x80?text=${encodeURIComponent(salon.name.charAt(0))}'">
                </div>
            </div>
            <div class="salon-info">
                <h3>${salon.name}</h3>
                <div class="salon-rating">
                    <i class="fas fa-star"></i>
                    <span>${rating.toFixed(1)}</span>
                    <span class="reviews">(${salon.total_reviews} reviews)</span>
                </div>
                <div class="salon-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${salon.address ? salon.address + ', ' : ''}${salon.city}</span>
                </div>
                <div class="salon-services">
                    ${servicesHtml}
                </div>
                <div class="salon-footer">
                    <div class="salon-price">
                        ${salon.price_range && salon.price_range.min ? 
                            `<span>Starting from</span><strong>₱${salon.price_range.min}</strong>` : 
                            '<span>Contact for pricing</span>'
                        }
                    </div>
                    <div class="salon-actions">
                        <button class="btn-chat" onclick="event.stopPropagation(); startChatWithSalon(${salon.id}, \`${salon.name}\`)">
                            <i class="fas fa-comment"></i> Chat
                        </button>
                        <button class="btn-book" onclick="event.stopPropagation(); openBookingModal(${salon.id})">
                            <i class="fas fa-calendar-plus"></i> Book Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// Generate star rating HTML
function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    
    return stars;
}

// Book salon function
function bookSalon(salonId) {
    // Find salon data
    const salon = window.currentSalonsData?.find(s => s.id === salonId);
    const salonName = salon ? salon.name : 'Salon';
    
    // Open booking modal
    openBookingModal(salonId, salonName);
}

// Toggle user dropdown menu
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('show');
}

// Close dropdown when clicking outside
window.addEventListener('click', function(event) {
    const userInfo = document.querySelector('.user-info');
    const dropdown = document.getElementById('userDropdown');
    
    if (!userInfo.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

// Logout function
function logout() {
    // Clear user data
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
    
    // Show notification
    showNotification('Logged out successfully', 'success');
    
    // Redirect to home page
    setTimeout(() => {
        window.location.href = '/';
    }, 1000);
}

// Notification system
function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}

// Add notification styles
const notificationStyles = `
    .notification {
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        color: white;
        font-weight: 600;
        z-index: 3000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 300px;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
    }
    
    .notification-success {
        background: linear-gradient(45deg, #28a745, #20c997);
    }
    
    .notification-error {
        background: linear-gradient(45deg, #dc3545, #fd7e14);
    }
    
    .notification-info {
        background: linear-gradient(45deg, #17a2b8, #6f42c1);
    }
    
    .notification button {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        margin-left: 1rem;
    }
    
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Handle favorite button clicks
document.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        this.classList.toggle('active');
        const icon = this.querySelector('i');
        
        if (this.classList.contains('active')) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            showNotification('Added to favorites', 'success');
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
            showNotification('Removed from favorites', 'info');
        }
    });
});

// Handle book now button clicks
document.querySelectorAll('.btn-book').forEach(btn => {
    btn.addEventListener('click', function() {
        const salonCard = this.closest('.salon-card');
        const salonName = salonCard.querySelector('h3').textContent;
        showNotification(`Booking ${salonName}...`, 'info');
        
        // In a real app, this would open a booking modal or redirect to booking page
        setTimeout(() => {
            showNotification('Booking feature coming soon!', 'info');
        }, 1000);
    });
});

// Handle service card clicks
document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', function() {
        const serviceName = this.querySelector('h3').textContent;
        showNotification(`Searching for ${serviceName} services...`, 'info');
    });
});

// Handle search
const searchInput = document.querySelector('.search-bar input');
if (searchInput) {
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
}

const searchButton = document.querySelector('.btn-search');
if (searchButton) {
    searchButton.addEventListener('click', handleSearch);
}

function handleSearch() {
    const searchInputField = document.querySelector('.search-bar input');
    if (searchInputField) {
        const searchTerm = searchInputField.value;
        if (searchTerm.trim()) {
            showNotification(`Searching for "${searchTerm}"...`, 'info');
            // In a real app, this would filter salons or redirect to search results
        }
    }
}

// Salon Application Modal Functions
function showSalonApplicationModal() {
    const modal = document.getElementById('salonApplicationModal');
    if (!modal) {
        // Modal doesn't exist on this page, redirect to customer home page
        window.location.href = '/customer-home.html#apply-salon';
        return;
    }
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeSalonApplicationModal() {
    const modal = document.getElementById('salonApplicationModal');
    if (!modal) return;
    
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
    
    // Reset form
    const form = document.getElementById('salonApplicationForm');
    if (form) form.reset();
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('salonApplicationModal');
    if (event.target === modal) {
        closeSalonApplicationModal();
    }
});

// Handle salon application form submission
const salonApplicationForm = document.getElementById('salonApplicationForm');
if (salonApplicationForm) {
    salonApplicationForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Get form data
    const formData = {
        salonName: document.getElementById('salonName').value,
        businessEmail: document.getElementById('businessEmail').value,
        salonPhone: document.getElementById('salonPhone').value,
        salonWebsite: document.getElementById('salonWebsite').value,
        salonAddress: document.getElementById('salonAddress').value,
        salonCity: document.getElementById('salonCity').value,
        salonState: document.getElementById('salonState').value,
        salonPostal: document.getElementById('salonPostal').value,
        salonDescription: document.getElementById('salonDescription').value,
        yearsInBusiness: document.getElementById('yearsInBusiness').value,
        staffCount: document.getElementById('staffCount').value,
        applicationReason: document.getElementById('applicationReason').value,
        services: []
    };
    
    // Get selected services
    const serviceCheckboxes = document.querySelectorAll('input[name="services"]:checked');
    serviceCheckboxes.forEach(checkbox => {
        formData.services.push(checkbox.value);
    });
    
    // Validate services
    if (formData.services.length === 0) {
        showNotification('Please select at least one service', 'error');
        return;
    }
    
    // Check terms agreement
    if (!document.getElementById('agreeTerms').checked) {
        showNotification('Please agree to the terms and conditions', 'error');
        return;
    }
    
    try {
        showNotification('Submitting your application...', 'info');
        
        // Get access token
        const accessToken = localStorage.getItem('access_token');
        
        if (!accessToken) {
            showNotification('Please log in to submit an application', 'error');
            return;
        }
        
        // Submit to backend
        const response = await fetch(`${window.API_BASE_URL}/api/salons/apply/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Application submitted successfully! We will review and contact you soon.', 'success');
            
            setTimeout(() => {
                closeSalonApplicationModal();
            }, 2000);
        } else {
            showNotification(data.error || 'Failed to submit application', 'error');
        }
        
    } catch (error) {
        console.error('Application error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
    });
}

// Search and Filtering Functions

// Initialize search functionality
function initializeSearch() {
    loadAvailableCities();
}

// Load available cities for filter dropdown
async function loadAvailableCities() {
    try {
        const response = await fetch(`${window.API_BASE_URL}/api/salons/filter/`, {
            method: 'GET'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.available_filters && data.available_filters.cities) {
                availableCities = data.available_filters.cities;
                populateCityFilter();
            }
        }
    } catch (error) {
        console.error('Error loading cities:', error);
    }
}

// Populate city filter dropdown
function populateCityFilter() {
    const cityFilter = document.getElementById('cityFilter');
    if (!cityFilter) return;
    
    cityFilter.innerHTML = '<option value="">All Cities</option>';
    
    if (!availableCities || availableCities.length === 0) return;
    
    availableCities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        cityFilter.appendChild(option);
    });
}

// Handle search input key press
function handleSearchKeyPress(event) {
    if (event.key === 'Enter') {
        performSearch();
    }
}

// Perform search
async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        showNotification('Please enter a search term', 'info');
        return;
    }
    
    try {
        showNotification('Searching salons...', 'info');
        
        const response = await fetch(`${window.API_BASE_URL}/api/salons/search/?q=${encodeURIComponent(query)}`, {
            method: 'GET'
        });
        
        if (response.ok) {
            const data = await response.json();
            displaySearchResults(data.salons, data.services, data.query, data.salon_count, data.service_count, data.total_count);
        } else {
            showNotification('Search failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Search error:', error);
        showNotification('Network error during search', 'error');
    }
}

// Toggle filters panel
function toggleFilters() {
    const filtersPanel = document.getElementById('filtersPanel');
    isFiltersPanelOpen = !isFiltersPanelOpen;
    
    filtersPanel.style.display = isFiltersPanelOpen ? 'block' : 'none';
    
    if (isFiltersPanelOpen && availableCities.length === 0) {
        loadAvailableCities();
    }
}

// Apply filters
async function applyFilters() {
    const filters = {
        city: document.getElementById('cityFilter').value,
        min_rating: document.getElementById('ratingFilter').value,
        min_price: document.getElementById('minPrice').value,
        max_price: document.getElementById('maxPrice').value,
        service: document.getElementById('serviceFilter').value,
        verified: document.getElementById('verifiedOnly').checked,
        sort: document.getElementById('sortFilter').value
    };
    
    // Build query parameters
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
        if (filters[key]) {
            params.append(key, filters[key]);
        }
    });
    
    try {
        showNotification('Applying filters...', 'info');
        
        const response = await fetch(`${window.API_BASE_URL}/api/salons/filter/?${params.toString()}`, {
            method: 'GET'
        });
        
        if (response.ok) {
            const data = await response.json();
            // For filters, we only show salons (not individual services)
            displaySearchResults(data.salons, [], 'Filtered Results', data.count, 0, data.count);
            toggleFilters(); // Close filters panel
        } else {
            showNotification('Filter failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Filter error:', error);
        showNotification('Network error during filtering', 'error');
    }
}

// Clear all filters
function clearFilters() {
    document.getElementById('cityFilter').value = '';
    document.getElementById('ratingFilter').value = '';
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.getElementById('serviceFilter').value = '';
    document.getElementById('verifiedOnly').checked = false;
    document.getElementById('sortFilter').value = 'name';
}

// Display search results
function displaySearchResults(salons, services, query, salonCount, serviceCount, totalCount) {
    const searchResultsSection = document.getElementById('searchResultsSection');
    const featuredSection = document.getElementById('featuredSection');
    const searchResults = document.getElementById('searchResults');
    const searchResultsTitle = document.getElementById('searchResultsTitle');
    const searchCount = document.getElementById('searchCount');
    
    // Update title and count
    searchResultsTitle.textContent = query === 'Filtered Results' ? 'Filtered Results' : `Search Results for "${query}"`;
    
    // Create detailed count message
    let countMessage = '';
    if (salonCount > 0 && serviceCount > 0) {
        countMessage = `${salonCount} salon${salonCount !== 1 ? 's' : ''} and ${serviceCount} service${serviceCount !== 1 ? 's' : ''} found`;
    } else if (salonCount > 0) {
        countMessage = `${salonCount} salon${salonCount !== 1 ? 's' : ''} found`;
    } else if (serviceCount > 0) {
        countMessage = `${serviceCount} service${serviceCount !== 1 ? 's' : ''} found`;
    } else {
        countMessage = 'No results found';
    }
    searchCount.textContent = countMessage;
    
    // Show search results, hide featured
    searchResultsSection.style.display = 'block';
    featuredSection.style.display = 'none';
    
    // Generate results
    if (totalCount === 0) {
        searchResults.innerHTML = `
            <div class="empty-search-state">
                <i class="fas fa-search" style="font-size: 3rem; color: #cbd5e0; margin-bottom: 1rem;"></i>
                <h3>No results found</h3>
                <p>Try adjusting your search terms or filters</p>
            </div>
        `;
        return;
    }
    
    let resultsHTML = '';
    
    // Add section headers and results
    if (salonCount > 0) {
        resultsHTML += `
            <div class="results-section-header">
                <h3><i class="fas fa-store"></i> Salons (${salonCount})</h3>
            </div>
        `;
        resultsHTML += salons.map(salon => createSalonCard(salon)).join('');
    }
    
    if (serviceCount > 0) {
        resultsHTML += `
            <div class="results-section-header">
                <h3><i class="fas fa-cut"></i> Services (${serviceCount})</h3>
            </div>
        `;
        resultsHTML += services.map(service => createServiceCard(service)).join('');
    }
    
    searchResults.innerHTML = resultsHTML;
}

// Create salon card HTML
function createSalonCard(salon) {
    const verified = salon.is_verified ? '<div class="salon-badge verified">Verified</div>' : '';
    const rating = salon.rating > 0 ? salon.rating.toFixed(1) : 'New';
    const reviewText = salon.total_reviews === 1 ? 'review' : 'reviews';
    const priceRange = salon.price_range ? `₱${salon.price_range.min} - ₱${salon.price_range.max}` : 'View Prices';
    
    // Handle cover image - use salon's cover_image if available, otherwise use placeholder
    const coverImage = salon.cover_image 
        ? `${window.API_BASE_URL}${salon.cover_image}` 
        : `https://via.placeholder.com/300x200?text=${encodeURIComponent(salon.name)}`;
    
    // Handle logo - use salon's logo if available, otherwise use placeholder
    const logoImage = salon.logo 
        ? `${window.API_BASE_URL}${salon.logo}` 
        : 'https://via.placeholder.com/80x80?text=' + encodeURIComponent(salon.name.charAt(0));
    
    return `
        <div class="salon-card" onclick="openBookingModal(${salon.id})">
            <div class="salon-image">
                <img src="${coverImage}" alt="${salon.name}" onerror="this.src='https://via.placeholder.com/300x200?text=${encodeURIComponent(salon.name)}'">
                ${verified}
                <button class="favorite-btn" onclick="event.stopPropagation(); toggleFavorite(${salon.id})">
                    <i class="far fa-heart"></i>
                </button>
                <div class="salon-logo">
                    <img src="${logoImage}" alt="${salon.name} logo" onerror="this.src='https://via.placeholder.com/80x80?text=${encodeURIComponent(salon.name.charAt(0))}'">
                </div>
            </div>
            <div class="salon-info">
                <h3>${salon.name}</h3>
                <div class="salon-rating">
                    <i class="fas fa-star"></i>
                    <span>${rating}</span>
                    <span class="reviews">(${salon.total_reviews} ${reviewText})</span>
                </div>
                <div class="salon-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${salon.address}, ${salon.city}</span>
                </div>
                <div class="salon-services">
                    ${salon.services.slice(0, 3).map(service => 
                        `<span class="service-tag">${service.name}</span>`
                    ).join('')}
                    ${salon.services_count > 3 ? `<span class="service-tag">+${salon.services_count - 3} more</span>` : ''}
                </div>
                <div class="salon-footer">
                    <div class="salon-price">
                        <span>Starting from</span>
                        <strong>${priceRange}</strong>
                    </div>
                    <div class="salon-actions">
                        <button class="btn-chat" onclick="event.stopPropagation(); startChatWithSalon(${salon.id}, \`${salon.name}\`)">
                            <i class="fas fa-comment"></i> Chat
                        </button>
                        <button class="btn-book" onclick="event.stopPropagation(); openBookingModal(${salon.id})">
                            <i class="fas fa-calendar-plus"></i> Book Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Create service card HTML
function createServiceCard(service) {
    const verified = service.salon.is_verified ? '<i class="fas fa-certificate verified-icon"></i>' : '';
    const rating = service.salon.rating > 0 ? service.salon.rating.toFixed(1) : 'New';
    const reviewText = service.salon.total_reviews === 1 ? 'review' : 'reviews';
    
    return `
        <div class="service-card" onclick="openBookingModal(${service.salon.id}, ${service.id})">
            <div class="service-header">
                <div class="service-type">
                    <i class="fas fa-cut"></i>
                    <span class="service-label">Service</span>
                </div>
                <div class="service-price">
                    <strong>₱${service.price}</strong>
                </div>
            </div>
            <div class="service-info">
                <h3>${service.name}</h3>
                <p class="service-description">${service.description || 'Professional service'}</p>
                <div class="service-details">
                    <span class="service-duration">
                        <i class="fas fa-clock"></i> ${service.duration} min
                    </span>
                    <span class="service-price-full">₱${service.price}</span>
                </div>
                <div class="service-salon">
                    <div class="salon-name">
                        <i class="fas fa-store"></i>
                        <span>${service.salon.name}</span>
                        ${verified}
                    </div>
                    <div class="salon-location">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${service.salon.address ? service.salon.address + ', ' : ''}${service.salon.city}</span>
                    </div>
                    <div class="salon-rating">
                        <i class="fas fa-star"></i>
                        <span>${rating} (${service.salon.total_reviews} ${reviewText})</span>
                    </div>
                </div>
                <div class="service-actions">
                    <button class="btn-book-service" onclick="event.stopPropagation(); openBookingModal(${service.salon.id}, ${service.id})">
                        <i class="fas fa-calendar-plus"></i> Book This Service
                    </button>
                    <button class="btn-view-salon" onclick="event.stopPropagation(); viewSalonProfile(${service.salon.id})">
                        <i class="fas fa-eye"></i> View Salon
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Clear search results
function clearSearch() {
    const searchResultsSection = document.getElementById('searchResultsSection');
    const featuredSection = document.getElementById('featuredSection');
    const searchInput = document.getElementById('searchInput');
    
    // Hide search results, show featured
    searchResultsSection.style.display = 'none';
    featuredSection.style.display = 'block';
    
    // Clear search input
    searchInput.value = '';
    
    // Clear filters
    clearFilters();
}

// Toggle favorite salon (placeholder)
function toggleFavorite(salonId) {
    // TODO: Implement favorite functionality
    showNotification('Favorites feature coming soon!', 'info');
}

// Note: openBookingModal is now implemented in booking.js

// View salon profile (placeholder)
function viewSalonProfile(salonId) {
    // TODO: Implement salon profile page
    showNotification(`Viewing salon ID: ${salonId}. Feature coming soon!`, 'info');
}

// Search initialization is now handled in the main DOMContentLoaded event listener above
