// Ensure API_BASE_URL is defined (fallback if config.js hasn't loaded yet)
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'https://web-production-e6265.up.railway.app';
    console.warn('⚠️ API_BASE_URL was undefined in salon-owner-dashboard.js, using fallback:', window.API_BASE_URL);
}

let salonData = null;
let servicesData = [];
let allBookings = [];

// Refresh access token if needed
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
        window.location.href = '/';
        return null;
    }
    
    try {
        const response = await fetch(`${window.API_BASE_URL}/api/accounts/token/refresh/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refresh: refreshToken })
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('access_token', data.access);
            console.log('Access token refreshed');
            return data.access;
        } else {
            console.error('Failed to refresh token');
            localStorage.clear();
            window.location.href = '/';
            return null;
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
        localStorage.clear();
        window.location.href = '/';
        return null;
    }
}

// Make authenticated API call with automatic token refresh
async function authenticatedFetch(url, options = {}) {
    let accessToken = localStorage.getItem('access_token');
    
    // Add authorization header
    if (!options.headers) {
        options.headers = {};
    }
    options.headers['Authorization'] = `Bearer ${accessToken}`;
    
    // Try the request
    let response = await fetch(url, options);
    
    // If 401, refresh token and retry
    if (response.status === 401) {
        console.log('Token expired, refreshing...');
        accessToken = await refreshAccessToken();
        
        if (accessToken) {
            options.headers['Authorization'] = `Bearer ${accessToken}`;
            response = await fetch(url, options);
        }
    }
    
    return response;
}

// Load data on page load
document.addEventListener('DOMContentLoaded', function() {
    checkOwnerAuth();
    loadUserData();
    loadSalonData();
    loadServices();
    loadBookings();
    loadTransactions(); // Load transactions for charts
});

// Tab switching for dashboard
function switchDashboardTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked tab and corresponding content
    const clickedTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
    
    const tabContent = document.getElementById(`tab-${tabName}`);
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // Wait for salon data to load before loading tab-specific data
    if (!salonData) {
        console.log('Waiting for salon data to load...');
        setTimeout(() => switchDashboardTab(tabName), 500);
        return;
    }
    
    // Load data based on tab
    if (tabName === 'bookings') {
        // Use existing displayAllBookings function
        if (allBookings && allBookings.length > 0) {
            displayAllBookings(allBookings);
        } else {
            loadBookings();
        }
    } else if (tabName === 'services') {
        // Use existing displayServicesFullView function
        if (servicesData && servicesData.length > 0) {
            displayServicesFullView();
        } else {
            loadServices();
        }
    } else if (tabName === 'transactions') {
        loadTransactions();
    } else if (tabName === 'reviews') {
        loadSalonReviews();
    } else if (tabName === 'salon-info') {
        displaySalonInfoFull();
    }
}

function checkOwnerAuth() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    
    if (!userData) {
        window.location.href = '/';
        return;
    }
    
    if (userData.user_type !== 'salon_owner') {
        showNotification('You must be a salon owner to access this page', 'error');
        setTimeout(() => {
            window.location.href = '/customer-home.html';
        }, 2000);
    }
}

function loadUserData() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    if (userData) {
        // userName element doesn't exist in HTML, skip this
        // User info is already shown in the navbar
        console.log('User data loaded:', userData.first_name);
    }
}

async function loadSalonData() {
    try {
        const response = await authenticatedFetch(`${window.API_BASE_URL}/api/salons/');
        
        if (response.ok) {
            const allSalons = await response.json();
            const userData = JSON.parse(localStorage.getItem('user_data'));
            
            console.log('All salons:', allSalons);
            console.log('User ID:', userData.id);
            
            // Find user's salon
            salonData = allSalons.find(salon => salon.owner_id === userData.id);
            
            if (salonData) {
                console.log('Found salon:', salonData);
                displaySalonInfo();
                updateStats();
            } else {
                console.log('No salon found for user');
                showNotification('Salon not found. Your application may still be pending approval.', 'error');
                document.getElementById('salonName').textContent = 'Salon Not Found';
                
                // Show helpful message
                document.getElementById('salonInfoContent').innerHTML = `
                    <div class="empty-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Your salon has not been set up yet.</p>
                        <p>If you recently applied, please wait for admin approval.</p>
                        <button class="btn-primary" onclick="window.location.href='/home'">
                            <i class="fas fa-home"></i> Go Back
                        </button>
                    </div>
                `;
            }
        } else {
            showNotification('Failed to load salon data', 'error');
        }
        
    } catch (error) {
        console.error('Error loading salon data:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

function displaySalonInfo() {
    console.log('Salon Data:', salonData); // Debug log
    
    // Update salon name
    document.getElementById('salonName').textContent = salonData.name;
    
    // Update salon location
    document.getElementById('salonCity').textContent = salonData.city;
    document.getElementById('salonState').textContent = salonData.state;
    
    // Update salon contact info
    document.getElementById('salonPhoneText').textContent = salonData.phone;
    document.getElementById('salonEmailText').textContent = salonData.email;
    
    // Display cover image
    const coverEl = document.getElementById('salonCover');
    if (coverEl) {
        if (salonData.cover_image_url) {
            console.log('Setting cover from cover_image_url:', salonData.cover_image_url);
            coverEl.style.backgroundImage = `url('${salonData.cover_image_url}')`;
        } else if (salonData.cover_image) {
            console.log('Setting cover from cover_image:', salonData.cover_image);
            const coverUrl = salonData.cover_image.startsWith('http') 
                ? salonData.cover_image 
                : `${window.API_BASE_URL}${salonData.cover_image}`;
            coverEl.style.backgroundImage = `url('${coverUrl}')`;
        } else {
            console.log('No cover image found, using default gradient');
        }
    }
    
    // Display logo
    const logoEl = document.getElementById('salonLogo');
    if (logoEl) {
        if (salonData.logo_url) {
            console.log('Setting logo from logo_url:', salonData.logo_url);
            logoEl.innerHTML = `<img src="${salonData.logo_url}" alt="${salonData.name} Logo">`;
        } else if (salonData.logo) {
            console.log('Setting logo from logo:', salonData.logo);
            const logoUrl = salonData.logo.startsWith('http') 
                ? salonData.logo 
                : `${window.API_BASE_URL}${salonData.logo}`;
            logoEl.innerHTML = `<img src="${logoUrl}" alt="${salonData.name} Logo">`;
        } else {
            console.log('No logo found, using default icon');
            // Default icon if no logo
            logoEl.innerHTML = '<i class="fas fa-store"></i>';
        }
    }
    
    // Show verified badge if verified
    if (salonData.is_verified) {
        document.getElementById('verifiedBadge').style.display = 'inline-flex';
    }
    
    // Update status badge
    const statusBadge = document.getElementById('statusBadge');
    if (salonData.is_active) {
        statusBadge.innerHTML = '<i class="fas fa-circle"></i> Active';
        statusBadge.style.background = 'rgba(76, 175, 80, 0.2)';
        statusBadge.style.color = '#4caf50';
    } else {
        statusBadge.innerHTML = '<i class="fas fa-circle"></i> Inactive';
        statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
        statusBadge.style.color = '#ef4444';
    }
    
    // Display salon information in overview tab (if element exists)
    const infoContent = document.getElementById('salonInfoContent');
    if (infoContent) {
        infoContent.innerHTML = `
        <div class="info-item">
            <span class="info-label">Email:</span>
            <span class="info-value">${salonData.email}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Phone:</span>
            <span class="info-value">${salonData.phone}</span>
        </div>
        ${salonData.website ? `
            <div class="info-item">
                <span class="info-label">Website:</span>
                <span class="info-value"><a href="${salonData.website}" target="_blank">${salonData.website}</a></span>
            </div>
        ` : ''}
        <div class="info-item">
            <span class="info-label">Location:</span>
            <span class="info-value">${salonData.city}, ${salonData.state}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Address:</span>
            <span class="info-value">${salonData.address}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Years in Business:</span>
            <span class="info-value">${salonData.years_in_business} years</span>
        </div>
        <div class="info-item">
            <span class="info-label">Staff Count:</span>
            <span class="info-value">${salonData.staff_count} members</span>
        </div>
    `;
    }
    
    // Display services
    displayServices();
}

function updateStats() {
    // For now, display salon stats
    document.getElementById('totalBookings').textContent = '0'; // TODO: Implement bookings
    document.getElementById('pendingBookings').textContent = '0';
    document.getElementById('totalRevenue').textContent = '₱0';
    document.getElementById('averageRating').textContent = salonData.rating.toFixed(1);
    
    // Update reviews tab
    document.getElementById('reviewsRating').textContent = salonData.rating.toFixed(1);
    document.getElementById('reviewsCount').textContent = `${salonData.total_reviews} reviews`;
}

async function loadServices() {
    try {
        const response = await authenticatedFetch(`${window.API_BASE_URL}/api/salons/services/');
        
        if (response.ok) {
            servicesData = await response.json();
            displayServices();
        } else {
            console.error('Failed to load services');
        }
        
    } catch (error) {
        console.error('Error loading services:', error);
    }
}

function displayServices() {
    const servicesGrid = document.getElementById('servicesGrid');
    
    if (!servicesData || servicesData.length === 0) {
        servicesGrid.innerHTML = `
            <div class="empty-message-sm">
                <i class="fas fa-scissors"></i>
                <p>No services added yet</p>
            </div>
        `;
        return;
    }
    
    servicesGrid.innerHTML = servicesData.map(service => `
        <div class="service-item">
            <div class="service-info">
                <div class="service-name">${service.name}</div>
                <div class="service-details-compact">
                    <div class="service-detail-item">
                        <i class="fas fa-dollar-sign"></i>
                        <span>₱${service.price}</span>
                    </div>
                    <div class="service-detail-item">
                        <i class="fas fa-clock"></i>
                        <span>${service.duration} min</span>
                    </div>
                </div>
            </div>
            <button class="btn-icon" onclick="editService(${service.id})" title="Edit">
                <i class="fas fa-edit"></i>
            </button>
        </div>
    `).join('');
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });
    
    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Modal functions
function showEditSalonModal() {
    if (!salonData) return;
    
    document.getElementById('editSalonName').value = salonData.name;
    document.getElementById('editSalonEmail').value = salonData.email;
    document.getElementById('editSalonPhone').value = salonData.phone;
    document.getElementById('editSalonWebsite').value = salonData.website || '';
    document.getElementById('editSalonDescription').value = salonData.description;
    document.getElementById('editSalonAddress').value = salonData.address;
    document.getElementById('editSalonCity').value = salonData.city;
    document.getElementById('editSalonState').value = salonData.state;
    
    document.getElementById('editSalonModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeEditSalonModal() {
    document.getElementById('editSalonModal').classList.remove('show');
    document.body.style.overflow = 'auto';
}

function showAddServiceModal() {
    document.getElementById('addServiceModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeAddServiceModal() {
    document.getElementById('addServiceModal').classList.remove('show');
    document.body.style.overflow = 'auto';
    document.getElementById('addServiceForm').reset();
}

// Form handlers
document.getElementById('editSalonForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const payload = {
        name: document.getElementById('editSalonName').value,
        email: document.getElementById('editSalonEmail').value,
        phone: document.getElementById('editSalonPhone').value,
        website: document.getElementById('editSalonWebsite').value,
        description: document.getElementById('editSalonDescription').value,
        address: document.getElementById('editSalonAddress').value,
        city: document.getElementById('editSalonCity').value,
        state: document.getElementById('editSalonState').value
    };
    
    try {
        showNotification('Saving salon profile...', 'info');
        const response = await authenticatedFetch(`${window.API_BASE_URL}/api/salons/profile/', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok) {
            // Update local salonData
            if (data.salon) {
                salonData = { ...salonData, ...data.salon };
            }
            displaySalonInfo();
            displaySalonInfoFull();
            showNotification('Salon information updated successfully!', 'success');
            closeEditSalonModal();
        } else {
            showNotification(data.error || 'Failed to update salon', 'error');
        }
    } catch (err) {
        console.error('Error updating salon profile:', err);
        showNotification('Network error. Please try again.', 'error');
    }
});

document.getElementById('addServiceForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('serviceName').value);
    formData.append('description', document.getElementById('serviceDescription').value);
    formData.append('price', document.getElementById('servicePrice').value);
    formData.append('duration', document.getElementById('serviceDuration').value);
    
    // Add service images if any
    serviceImageFiles.forEach((file, index) => {
        formData.append(`images`, file);
    });
    
    try {
        const accessToken = localStorage.getItem('access_token');
        
        showNotification('Adding service...', 'info');
        
        const response = await authenticatedFetch(`${window.API_BASE_URL}/api/salons/services/', {
            method: 'POST',
            body: formData,
            isFormData: true
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(`Service "${document.getElementById('serviceName').value}" added successfully!`, 'success');
            closeAddServiceModal();
            loadServices(); // Reload services list
            
            // Clear image files and preview
            serviceImageFiles = [];
            document.getElementById('imagePreviewContainer').innerHTML = '';
        } else {
            showNotification(data.error || 'Failed to add service', 'error');
        }
        
    } catch (error) {
        console.error('Error adding service:', error);
        showNotification('Network error. Please try again.', 'error');
    }
});

function editService(serviceId) {
    const service = servicesData.find(s => s.id === serviceId);
    if (!service) {
        showNotification('Service not found', 'error');
        return;
    }
    
    // Populate edit modal
    document.getElementById('editServiceId').value = service.id;
    document.getElementById('editServiceName').value = service.name;
    document.getElementById('editServiceDescription').value = service.description;
    document.getElementById('editServicePrice').value = service.price;
    document.getElementById('editServiceDuration').value = service.duration;
    
    // Show existing images
    const existingImagesContainer = document.getElementById('existingServiceImages');
    if (service.images && service.images.length > 0) {
        existingImagesContainer.innerHTML = service.images.map(img => `
            <div class="existing-image-item">
                <img src="${img}" alt="Service image">
            </div>
        `).join('');
    } else {
        existingImagesContainer.innerHTML = '<p style="color: #999;">No images uploaded</p>';
    }
    
    // Clear new image preview
    document.getElementById('editImagePreviewContainer').innerHTML = '';
    editServiceImageFiles = [];
    
    // Show modal
    document.getElementById('editServiceModal').style.display = 'block';
}

function deleteService(serviceId, serviceName) {
    if (!confirm(`Are you sure you want to delete "${serviceName}"?`)) {
        return;
    }
    
    authenticatedFetch(`${window.API_BASE_URL}/api/salons/services/${serviceId}/`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            showNotification(data.message, 'success');
            loadServices(); // Reload services
        } else {
            showNotification(data.error || 'Failed to delete service', 'error');
        }
    })
    .catch(error => {
        console.error('Error deleting service:', error);
        showNotification('Network error. Please try again.', 'error');
    });
}

// Load bookings
async function loadBookings() {
    try {
        const response = await authenticatedFetch(`${window.API_BASE_URL}/api/bookings/salon-bookings/');
        
        if (response.ok) {
            allBookings = await response.json();
            console.log('Bookings loaded:', allBookings);
            displayBookings(allBookings);
            updateBookingStats(allBookings);
            
            // Initialize analytics charts after bookings are loaded
            setTimeout(() => initializeCharts(), 500);
        } else {
            console.error('Failed to load bookings');
        }
        
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

// Display bookings
function displayBookings(bookings) {
    const container = document.getElementById('recentBookingsContent');
    
    // Skip if container doesn't exist (we're using charts now)
    if (!container) return;
    
    if (!bookings || bookings.length === 0) {
        container.innerHTML = `
            <div class="empty-message-sm">
                <i class="fas fa-calendar-times"></i>
                <p>No bookings yet</p>
            </div>
        `;
        return;
    }
    
    // Show only pending/confirmed bookings, limit to 5
    const upcomingBookings = bookings
        .filter(b => b.status === 'pending' || b.status === 'confirmed')
        .slice(0, 5);
    
    if (upcomingBookings.length === 0) {
        container.innerHTML = `
            <div class="empty-message-sm">
                <i class="fas fa-calendar-check"></i>
                <p>No upcoming bookings</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = upcomingBookings.map(booking => `
        <div class="booking-item">
            <div class="booking-info">
                <div class="booking-customer">
                    <strong>${booking.customer.name}</strong>
                    <span class="booking-service">${booking.service.name}</span>
                </div>
                <div class="booking-datetime">
                    <i class="fas fa-calendar"></i> ${new Date(booking.booking_date).toLocaleDateString()}
                    <i class="fas fa-clock"></i> ${formatTime(booking.booking_time)}
                </div>
            </div>
            <div class="booking-actions">
                ${booking.status === 'pending' ? `
                    <button class="btn-sm btn-confirm" onclick="updateBookingStatus(${booking.id}, 'confirmed')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-sm btn-cancel" onclick="updateBookingStatus(${booking.id}, 'cancelled')">
                        <i class="fas fa-times"></i>
                    </button>
                ` : `
                    <span class="status-badge status-${booking.status}">${booking.status}</span>
                `}
            </div>
        </div>
    `).join('');
}

// Update booking stats
function updateBookingStats(bookings) {
    const total = bookings.length;
    const pending = bookings.filter(b => b.status === 'pending').length;
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const completed = bookings.filter(b => b.status === 'completed').length;
    
    // Calculate total revenue from bookings with completed payments
    const totalRevenue = bookings
        .filter(b => b.payment_status === 'completed')
        .reduce((sum, b) => sum + parseFloat(b.price || b.total_price || 0), 0);
    
    document.getElementById('totalBookings').textContent = total;
    document.getElementById('pendingBookings').textContent = pending;
    document.getElementById('totalRevenue').textContent = `₱${totalRevenue.toFixed(2)}`;
    
    // Update average rating from salon data
    if (salonData && salonData.average_rating !== undefined) {
        document.getElementById('averageRating').textContent = salonData.average_rating.toFixed(1);
    } else if (salonData && salonData.rating !== undefined) {
        document.getElementById('averageRating').textContent = salonData.rating.toFixed(1);
    } else {
        document.getElementById('averageRating').textContent = '0.0';
    }
}

// Update booking status
async function updateBookingStatus(bookingId, newStatus) {
    try {
        const accessToken = localStorage.getItem('access_token');
        
        const actionMap = {
            'confirmed': 'confirm',
            'cancelled': 'cancel',
            'completed': 'complete'
        };
        const action = actionMap[newStatus] || newStatus;
        
        if (!confirm(`Are you sure you want to ${action} this booking?`)) {
            return;
        }
        
        showNotification(`${action.charAt(0).toUpperCase() + action.slice(1)}ing booking...`, 'info');
        
        const response = await authenticatedFetch(`${window.API_BASE_URL}/api/bookings/${bookingId}/update-status/`, {
            method: 'POST',
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(`Booking ${action}d successfully! Email sent to customer.`, 'success');
            loadBookings(); // Reload bookings
        } else {
            showNotification(data.error || 'Failed to update booking', 'error');
        }
        
    } catch (error) {
        console.error('Error updating booking:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Format time
function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

function filterBookings(status) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Filter and display bookings
    if (status === 'all') {
        displayAllBookings(allBookings);
    } else {
        const filtered = allBookings.filter(b => b.status === status);
        displayAllBookings(filtered);
    }
}

// Display all bookings in full view
function displayAllBookings(bookings) {
    const container = document.getElementById('allBookingsContent');
    
    if (!bookings || bookings.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-calendar-times"></i>
                <p>No bookings found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = bookings.map(booking => {
        // Determine payment status badge
        let paymentBadge = '';
        let paymentIcon = '';
        
        if (booking.payment_status === 'completed') {
            paymentBadge = '<span class="payment-badge paid">PAID</span>';
            // Show payment method icon for completed payments
            if (booking.payment_method === 'paypal') {
                paymentIcon = '<i class="fab fa-paypal" style="color: #0070ba; font-size: 1.2rem;" title="Paid with PayPal"></i>';
            } else if (booking.payment_method === 'stripe') {
                paymentIcon = '<i class="fas fa-credit-card" style="color: #6366f1; font-size: 1.2rem;" title="Paid with Credit Card"></i>';
            }
        } else if (booking.payment_method === 'pay_later') {
            paymentBadge = '<span class="payment-badge pay-later">PAY AT SALON</span>';
        } else {
            paymentBadge = '<span class="payment-badge pending">PENDING</span>';
        }
        
        // Get customer initials for avatar
        const nameParts = booking.customer.name.split(' ');
        const initials = nameParts.length > 1 
            ? nameParts[0][0] + nameParts[nameParts.length - 1][0]
            : nameParts[0][0];
        
        return `
        <div class="booking-list-item">
            <div class="booking-main-row">
                <div class="booking-customer-section">
                    <div class="customer-avatar">
                        ${booking.customer.profile_picture 
                            ? `<img src="${booking.customer.profile_picture}" alt="${booking.customer.name}">` 
                            : `<div class="avatar-initials">${initials.toUpperCase()}</div>`
                        }
                    </div>
                    <div class="customer-info-wrapper">
                        <div class="customer-name-row">
                            <strong class="customer-name">${booking.customer.name}</strong>
                            ${paymentBadge}
                            ${paymentIcon}
                        </div>
                        <div class="service-info-compact">
                            <i class="fas fa-scissors"></i>
                            <span>${booking.service.name}</span>
                            <span class="price-tag">₱${booking.price}</span>
                        </div>
                    </div>
                </div>
                
                <div class="booking-details-compact">
                    <div class="detail-compact">
                        <i class="fas fa-calendar"></i>
                        <span>${new Date(booking.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div class="detail-compact">
                        <i class="fas fa-clock"></i>
                        <span>${formatTime(booking.booking_time)}</span>
                    </div>
                    <div class="detail-compact">
                        <i class="fas fa-envelope"></i>
                        <span>${booking.customer.email}</span>
                    </div>
                    <div class="detail-compact">
                        <i class="fas fa-phone"></i>
                        <span>${booking.customer.phone}</span>
                    </div>
                </div>
                
                <div class="booking-actions-section">
                    <div class="status-badge-compact status-${booking.status}">
                        ${booking.status.toUpperCase()}
                    </div>
                    <button class="btn-view" onclick="viewBookingDetails(${booking.id})" title="View Details">
                        <i class="fas fa-eye"></i>
                        <span>View</span>
                    </button>
                </div>
            </div>
            ${booking.notes ? `
                <div class="booking-notes-compact">
                    <i class="fas fa-note-sticky"></i>
                    <span>${booking.notes}</span>
                </div>
            ` : ''}
        </div>
        `;
    }).join('');
}

// Display services in full view
function displayServicesFullView() {
    const container = document.getElementById('servicesGridFull');
    
    if (!servicesData || servicesData.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-scissors"></i>
                <p>No services added yet</p>
                <button class="btn-primary" onclick="showAddServiceModal()">
                    <i class="fas fa-plus"></i> Add Your First Service
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = servicesData.map(service => `
        <div class="service-item">
            ${service.images && service.images.length > 0 ? `
                <div class="service-images">
                    ${service.images.slice(0, 3).map((img, idx) => `
                        <img src="${img}" alt="${service.name}" class="service-image-thumb">
                    `).join('')}
                    ${service.images.length > 3 ? `<span class="more-images">+${service.images.length - 3}</span>` : ''}
                </div>
            ` : `<div class="no-images-placeholder"><i class="fas fa-image"></i><span>No photos</span></div>`}
            <div class="service-info">
                <div class="service-name">${service.name}</div>
                <div class="service-description-small">${service.description}</div>
                <div class="service-details-compact">
                    <div class="service-detail-item">
                        <i class="fas fa-dollar-sign"></i>
                        <span>₱${service.price}</span>
                    </div>
                    <div class="service-detail-item">
                        <i class="fas fa-clock"></i>
                        <span>${service.duration} min</span>
                    </div>
                </div>
            </div>
            <div class="service-actions">
                <button class="btn-icon" onclick="editService(${service.id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" onclick="deleteService(${service.id}, '${service.name.replace(/'/g, "&#39;")}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Display salon info in full view
function displaySalonInfoFull() {
    const container = document.getElementById('salonInfoContentFull');
    
    if (!salonData) {
        container.innerHTML = '<div class="loading">Loading...</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="info-grid">
            <div class="info-item">
                <span class="info-label">Business Email</span>
                <span class="info-value">${salonData.email}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Phone</span>
                <span class="info-value">${salonData.phone}</span>
            </div>
            <div class="info-item full-width">
                <span class="info-label">Description</span>
                <span class="info-value">${salonData.description}</span>
            </div>
            <div class="info-item full-width">
                <span class="info-label">Address</span>
                <span class="info-value">${salonData.address}, ${salonData.city}, ${salonData.state}</span>
            </div>
            ${salonData.website ? `
                <div class="info-item">
                    <span class="info-label">Website</span>
                    <span class="info-value"><a href="${salonData.website}" target="_blank">${salonData.website}</a></span>
                </div>
            ` : ''}
        </div>
    `;
}

// Toggle user menu
function toggleUserMenu() {
    document.getElementById('userDropdown').classList.toggle('show');
}

// Close dropdown when clicking outside
window.addEventListener('click', function(event) {
    const userInfo = document.querySelector('.user-info');
    const dropdown = document.getElementById('userDropdown');
    
    if (!userInfo.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }
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
    }, 5000);
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
        background: linear-gradient(45deg, #dc3545, #c82333);
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

// Transactions functionality
let allTransactions = [];
let currentFilter = 'all';

async function loadTransactions() {
    try {
        const response = await authenticatedFetch(`${window.API_BASE_URL}/api/bookings/salon-transactions/');
        
        const data = await response.json();
        console.log('Transactions API response:', data);
        
        if (response.ok) {
            // Handle transaction response structure
            allTransactions = data.transactions || [];
            
            if (!Array.isArray(allTransactions)) {
                console.error('Transactions is not an array:', allTransactions);
                allTransactions = [];
            }
            
            // Sort by ID descending (newest first)
            allTransactions.sort((a, b) => b.id - a.id);
            
            console.log('All transactions:', allTransactions);
            console.log('Number of transactions:', allTransactions.length);
            
            displayTransactions(allTransactions);
            
            // Update summary stats if available
            if (data.summary) {
                updateTransactionSummary(data.summary);
            } else {
                calculateTransactionStats(allTransactions);
            }
            
            // Reinitialize charts that depend on transaction data
            initRevenueChart();
            initTransactionChart();
        } else {
            showNotification(data.error || 'Failed to load transactions', 'error');
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
        showNotification('Error loading transactions', 'error');
        allTransactions = [];
        calculateTransactionStats([]);
        displayTransactions([]);
    }
}

function calculateTransactionStats(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
        document.getElementById('totalRevenue').textContent = '₱0.00';
        document.getElementById('pendingPayments').textContent = '₱0.00';
        document.getElementById('totalTransactions').textContent = '0';
        return;
    }
    
    const completed = transactions.filter(t => t.status === 'completed');
    const pending = transactions.filter(t => t.status === 'pending');
    
    // Use salon_payout for revenue (what salon actually receives after platform fees)
    const totalRevenue = completed.reduce((sum, t) => sum + parseFloat(t.salon_payout || t.amount || 0), 0);
    const pendingAmount = pending.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    
    document.getElementById('transactionTotalRevenue').textContent = `₱${totalRevenue.toFixed(2)}`;
    document.getElementById('transactionPendingPayments').textContent = `₱${pendingAmount.toFixed(2)}`;
    document.getElementById('totalTransactions').textContent = transactions.length;
}

function updateTransactionSummary(summary) {
    // Update with server-calculated summary if available
    if (summary.total_revenue !== undefined) {
        const elem = document.getElementById('transactionTotalRevenue');
        if (elem) {
            elem.textContent = `₱${summary.total_revenue.toFixed(2)}`;
        }
    }
    if (summary.pending_payments !== undefined) {
        const elem = document.getElementById('transactionPendingPayments');
        if (elem) {
            elem.textContent = `₱${summary.pending_payments.toFixed(2)}`;
        }
    }
    if (summary.transaction_count !== undefined) {
        const elem = document.getElementById('transactionTotalCount');
        if (elem) {
            elem.textContent = summary.transaction_count;
        }
    }
}

function displayTransactions(transactions) {
    const tbody = document.getElementById('transactionsTableBody');
    
    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No transactions found</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => {
        const paymentStatus = transaction.status || 'pending';
        
        // Format payment method display
        const paymentMethodMap = {
            'paypal': 'PayPal',
            'stripe': 'Stripe',
            'pay_later': 'Pay Later',
            'cash': 'Cash',
            'card': 'Credit Card'
        };
        const paymentMethod = transaction.payment_method ? 
            (paymentMethodMap[transaction.payment_method] || transaction.payment_method.toUpperCase()) : 'N/A';
        
        return `
        <tr>
            <td>${transaction.created_at ? new Date(transaction.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' }) : 'N/A'}</td>
            <td>
                <div class="customer-info">
                    <div class="customer-name">${transaction.customer_name || 'N/A'}</div>
                    <div class="customer-email">${transaction.customer_email || 'N/A'}</div>
                </div>
            </td>
            <td>${transaction.service_name || 'N/A'}</td>
            <td style="font-weight: 600; color: #dc3545;">₱${transaction.amount || 0}</td>
            <td>
                <span class="status-badge status-${paymentStatus}" style="${paymentStatus === 'completed' ? 'background: #10b981; color: white;' : ''}">
                    ${paymentStatus === 'completed' ? '<i class="fas fa-check-circle"></i>' : 
                      paymentStatus === 'pending' ? '<i class="fas fa-clock"></i>' : 
                      '<i class="fas fa-times-circle"></i>'}
                    ${paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
                </span>
            </td>
            <td>
                <span class="status-badge status-${transaction.booking_status}">
                    ${transaction.booking_status ? transaction.booking_status.charAt(0).toUpperCase() + transaction.booking_status.slice(1) : 'N/A'}
                </span>
            </td>
            <td style="font-size: 0.9rem; color: #e2e8f0; font-weight: 500;">
                ${paymentMethod}
            </td>
        </tr>
        `;
    }).join('');
}

function filterTransactions(filter) {
    currentFilter = filter;
    
    // Update filter button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Filter transactions
    let filtered = allTransactions;
    if (filter !== 'all') {
        filtered = allTransactions.filter(t => t.status === filter);
    }
    
    displayTransactions(filtered);
}

// ============== ANALYTICS CHARTS ==============
let bookingsTrendChart, revenueChart, servicesChart, statusChart, transactionChart;

function initializeCharts() {
    initBookingsTrendChart();
    initRevenueChart();
    initServicesChart();
    initStatusChart();
    initTransactionChart();
    initTopCustomersLeaderboard();
}

function initBookingsTrendChart() {
    const ctx = document.getElementById('bookingsTrendChart');
    if (!ctx) return;
    
    // Get last 7 days data
    const last7Days = [];
    const bookingCounts = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        // Count bookings for this day
        const count = allBookings.filter(b => {
            const bookingDate = new Date(b.booking_date);
            return bookingDate.toDateString() === date.toDateString();
        }).length;
        bookingCounts.push(count);
    }
    
    if (bookingsTrendChart) bookingsTrendChart.destroy();
    
    bookingsTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Bookings',
                data: bookingCounts,
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 5,
                pointBackgroundColor: '#dc3545',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#94a3b8'
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function initRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    console.log('Initializing revenue chart with transactions:', allTransactions);
    
    // Group revenue by date from all transactions (using GMT+8)
    const revenueByDate = {};
    
    allTransactions.forEach(t => {
        if (t.status === 'completed') {
            // Use created_at (when transaction happened) and convert to GMT+8
            const date = new Date(t.created_at);
            const gmt8Date = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
            const dateKey = gmt8Date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                timeZone: 'Asia/Manila'
            });
            
            if (!revenueByDate[dateKey]) {
                revenueByDate[dateKey] = 0;
            }
            revenueByDate[dateKey] += parseFloat(t.amount || 0);
        }
    });
    
    console.log('Revenue by date (GMT+8):', revenueByDate);
    
    // Get sorted dates and values
    const dates = Object.keys(revenueByDate).sort((a, b) => {
        return new Date(a) - new Date(b);
    });
    const revenues = dates.map(date => revenueByDate[date]);
    
    console.log('Chart labels:', dates);
    console.log('Chart data:', revenues);
    
    if (revenueChart) revenueChart.destroy();
    
    revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates.length > 0 ? dates : ['No data'],
            datasets: [{
                label: 'Revenue',
                data: revenues.length > 0 ? revenues : [0],
                backgroundColor: 'rgba(220, 53, 69, 0.8)',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => '₱' + value,
                        color: '#94a3b8'
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function initServicesChart() {
    const ctx = document.getElementById('servicesChart');
    if (!ctx) return;
    
    // Count bookings per service
    const serviceCounts = {};
    allBookings.forEach(booking => {
        const serviceName = booking.service_name || 'Unknown';
        serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
    });
    
    // Get top 5 services
    const topServices = Object.entries(serviceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const labels = topServices.map(s => s[0]);
    const data = topServices.map(s => s[1]);
    
    const colors = [
        '#dc3545',
        '#c82333',
        '#ff6b6b',
        '#ff8787',
        '#ffa3a3'
    ];
    
    if (servicesChart) servicesChart.destroy();
    
    servicesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#1a1a1a'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function initStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;
    
    // Count bookings by status
    const statusCounts = {
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0
    };
    
    allBookings.forEach(booking => {
        const status = booking.status || 'pending';
        if (statusCounts.hasOwnProperty(status)) {
            statusCounts[status]++;
        }
    });
    
    if (statusChart) statusChart.destroy();
    
    statusChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
            datasets: [{
                data: [
                    statusCounts.pending,
                    statusCounts.confirmed,
                    statusCounts.completed,
                    statusCounts.cancelled
                ],
                backgroundColor: [
                    '#f59e0b',
                    '#3b82f6',
                    '#10b981',
                    '#ef4444'
                ],
                borderWidth: 2,
                borderColor: '#1a1a1a'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function initTransactionChart() {
    const ctx = document.getElementById('transactionChart');
    if (!ctx) return;
    
    // Calculate transaction data for last 7 days
    const last7Days = [];
    const completedData = [];
    const pendingData = [];
    
    for (let i = 6; i >= 0; i--) {
        // Get date in GMT+8
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        now.setDate(now.getDate() - i);
        const dateStr = now.toDateString();
        
        last7Days.push(now.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            timeZone: 'Asia/Manila'
        }));
        
        // Count completed transactions (GMT+8)
        const completedCount = allTransactions.filter(t => {
            const transactionDate = new Date(new Date(t.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
            return transactionDate.toDateString() === dateStr && 
                   t.status === 'completed';
        }).length;
        
        // Count pending transactions (GMT+8)
        const pendingCount = allTransactions.filter(t => {
            const transactionDate = new Date(new Date(t.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
            return transactionDate.toDateString() === dateStr && 
                   t.status === 'pending';
        }).length;
        
        completedData.push(completedCount);
        pendingData.push(pendingCount);
    }
    
    if (transactionChart) transactionChart.destroy();
    
    transactionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [
                {
                    label: 'Completed',
                    data: completedData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Pending',
                    data: pendingData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#94a3b8',
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function initTopCustomersLeaderboard() {
    const leaderboardDiv = document.getElementById('topCustomersLeaderboard');
    if (!leaderboardDiv) return;
    
    // Count bookings per customer
    const customerBookings = {};
    
    allBookings.forEach(booking => {
        const customer = booking.customer;
        if (!customer) return;
        
        // Use email as unique identifier since there's no ID field
        const customerId = customer.email;
        const customerName = customer.name || 'Unknown Customer';
        
        if (!customerId) return;
        
        if (!customerBookings[customerId]) {
            customerBookings[customerId] = {
                name: customerName,
                count: 0,
                revenue: 0
            };
        }
        
        customerBookings[customerId].count++;
        customerBookings[customerId].revenue += parseFloat(booking.price || booking.total_price || 0);
    });
    
    // Get top 5 customers
    const topCustomers = Object.values(customerBookings)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    
    if (topCustomers.length === 0) {
        leaderboardDiv.innerHTML = '<div class="empty-message-sm"><i class="fas fa-users"></i><p>No customer data yet</p></div>';
        return;
    }
    
    leaderboardDiv.innerHTML = topCustomers.map((customer, index) => `
        <div class="leaderboard-item">
            <div class="leaderboard-rank">#${index + 1}</div>
            <div class="leaderboard-info">
                <div class="leaderboard-name">${customer.name}</div>
                <div class="leaderboard-details">${customer.count} bookings • ₱${customer.revenue.toFixed(2)}</div>
            </div>
            <div class="leaderboard-value">${customer.count}</div>
        </div>
    `).join('');
}

// ============================================
// REVIEWS TAB FUNCTIONS
// ============================================

let allSalonReviews = [];
let currentReviewFilter = 'all';

async function loadSalonReviews() {
    if (!salonData) {
        console.error('No salon data loaded');
        document.getElementById('salonReviewsList').innerHTML = '<div class="empty-message"><i class="fas fa-exclamation-circle"></i><p>Salon data not loaded</p></div>';
        return;
    }
    
    try {
        console.log('Loading reviews for salon ID:', salonData.id);
        
        // Use authenticatedFetch to send token so salon owner can see all reviews
        // Add cache-busting parameter to ensure fresh data
        const timestamp = new Date().getTime();
        const response = await authenticatedFetch(`${window.API_BASE_URL}/api/salons/${salonData.id}/reviews/?_=${timestamp}`, {
            cache: 'no-cache'
        });
        
        console.log('Reviews response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Reviews fetch error:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('Reviews data received:', data);
        console.log('Number of reviews:', data.reviews ? data.reviews.length : 0);
        
        if (data.reviews !== undefined) {
            allSalonReviews = data.reviews;
            
            // Update stats
            const avgRating = data.average_rating || 0;
            const totalCount = data.total || 0;
            
            document.getElementById('reviewsAverageRating').textContent = avgRating.toFixed(1);
            document.getElementById('reviewsTotalCount').textContent = totalCount;
            
            // Count reviews without response
            const noResponseCount = allSalonReviews.filter(r => !r.salon_response).length;
            document.getElementById('reviewsPendingCount').textContent = noResponseCount;
            
            // Display reviews
            displaySalonReviews(allSalonReviews);
            
            console.log('Reviews displayed successfully');
        } else {
            console.error('No reviews property in response data');
            document.getElementById('salonReviewsList').innerHTML = '<div class="empty-message"><i class="fas fa-exclamation-circle"></i><p>Failed to load reviews</p></div>';
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
        document.getElementById('salonReviewsList').innerHTML = `<div class="empty-message"><i class="fas fa-exclamation-circle"></i><p>Error loading reviews: ${error.message}</p></div>`;
    }
}

function filterSalonReviews(filter) {
    currentReviewFilter = filter;
    
    // Update active filter button
    document.querySelectorAll('.reviews-filters .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Filter reviews
    let filteredReviews = allSalonReviews;
    
    if (filter !== 'all') {
        if (filter === 'no-response') {
            filteredReviews = allSalonReviews.filter(r => !r.salon_response);
        } else {
            filteredReviews = allSalonReviews.filter(r => r.rating === parseInt(filter));
        }
    }
    
    displaySalonReviews(filteredReviews);
}

function displaySalonReviews(reviews) {
    const container = document.getElementById('salonReviewsList');
    
    if (!reviews || reviews.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-star"></i>
                <p>No reviews yet</p>
                <small>Reviews will appear here once customers leave feedback</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = reviews.map(review => `
        <div class="review-card salon-owner-view ${review.status === 'pending' ? 'review-pending' : ''}">
            <div class="review-header">
                <div class="reviewer-info">
                    <div class="reviewer-avatar">${review.customer_name.charAt(0).toUpperCase()}</div>
                    <div>
                        <strong>${review.customer_name}</strong>
                        ${review.is_verified_booking ? '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified</span>' : ''}
                        ${review.status === 'pending' ? '<span class="status-badge pending-badge"><i class="fas fa-clock"></i> Pending Approval</span>' : ''}
                        ${review.status === 'approved' ? '<span class="status-badge approved-badge"><i class="fas fa-check"></i> Approved</span>' : ''}
                        <div class="review-date">${formatDate(review.created_at)}</div>
                    </div>
                </div>
                <div class="review-rating">${'⭐'.repeat(review.rating)} ${review.rating}/5</div>
            </div>
            
            ${review.title ? `<h4 class="review-title">"${review.title}"</h4>` : ''}
            
            <p class="review-comment">${review.comment}</p>
            
            ${review.booking ? `
                <div class="review-booking-info">
                    <i class="fas fa-receipt"></i> Booking #${review.booking}
                </div>
            ` : ''}
            
            ${review.salon_response ? `
                <div class="salon-response">
                    <strong><i class="fas fa-reply"></i> Your Response:</strong>
                    <p>${review.salon_response}</p>
                </div>
            ` : `
                <button class="btn-respond" onclick="showRespondModal(${review.id})">
                    <i class="fas fa-reply"></i> Respond to Review
                </button>
            `}
        </div>
    `).join('');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Salon Profile & Cover Image Upload Functions
function uploadSalonLogo() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showNotification('Logo file size must be less than 5MB', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('logo', file);
        
        try {
            showNotification('Uploading logo...', 'info');
            const response = await authenticatedFetch(`${window.API_BASE_URL}/api/salons/upload-logo/', {
                method: 'POST',
                body: formData,
                isFormData: true
            });
            
            const data = await response.json();
            if (response.ok) {
                showNotification('Logo uploaded successfully!', 'success');
                // Reload salon data to get the updated logo URL
                await loadSalonData();
            } else {
                showNotification(data.error || 'Failed to upload logo', 'error');
            }
        } catch (error) {
            console.error('Logo upload error:', error);
            showNotification('Network error. Please try again.', 'error');
        }
    };
    input.click();
}

function uploadSalonCover() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Validate file size (max 10MB for cover)
        if (file.size > 10 * 1024 * 1024) {
            showNotification('Cover image file size must be less than 10MB', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('cover_image', file);
        
        try {
            showNotification('Uploading cover image...', 'info');
            const response = await authenticatedFetch(`${window.API_BASE_URL}/api/salons/upload-cover/', {
                method: 'POST',
                body: formData,
                isFormData: true
            });
            
            const data = await response.json();
            if (response.ok) {
                showNotification('Cover image uploaded successfully!', 'success');
                // Reload salon data to get the updated cover URL
                await loadSalonData();
            } else {
                showNotification(data.error || 'Failed to upload cover image', 'error');
            }
        } catch (error) {
            console.error('Cover upload error:', error);
            showNotification('Network error. Please try again.', 'error');
        }
    };
    input.click();
}

// Handle multiple service image uploads
let serviceImageFiles = [];
let editServiceImageFiles = [];

// Initialize image preview handler
document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('serviceImages');
    if (imageInput) {
        imageInput.addEventListener('change', handleServiceImageSelect);
    }
    
    const editImageInput = document.getElementById('editServiceImages');
    if (editImageInput) {
        editImageInput.addEventListener('change', handleEditServiceImageSelect);
    }
});

function handleServiceImageSelect(event) {
    const files = Array.from(event.target.files);
    const previewContainer = document.getElementById('imagePreviewContainer');
    
    files.forEach(file => {
        // Validate file size (max 5MB per image)
        if (file.size > 5 * 1024 * 1024) {
            showNotification(`${file.name} is too large (max 5MB)`, 'error');
            return;
        }
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showNotification(`${file.name} is not an image`, 'error');
            return;
        }
        
        // Add to files array
        serviceImageFiles.push(file);
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button class="remove-image" onclick="removeServiceImage(${serviceImageFiles.length - 1})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            previewContainer.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
    
    // Clear input to allow re-selecting same files
    event.target.value = '';
}

function removeServiceImage(index) {
    serviceImageFiles.splice(index, 1);
    
    // Rebuild preview
    const previewContainer = document.getElementById('imagePreviewContainer');
    previewContainer.innerHTML = '';
    
    serviceImageFiles.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button class="remove-image" onclick="removeServiceImage(${idx})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            previewContainer.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
}

// Handle edit service image selection
function handleEditServiceImageSelect(event) {
    const files = Array.from(event.target.files);
    const previewContainer = document.getElementById('editImagePreviewContainer');
    
    files.forEach(file => {
        // Validate file size (max 5MB per image)
        if (file.size > 5 * 1024 * 1024) {
            showNotification(`${file.name} is too large (max 5MB)`, 'error');
            return;
        }
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showNotification(`${file.name} is not an image`, 'error');
            return;
        }
        
        // Add to files array
        editServiceImageFiles.push(file);
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button class="remove-image" onclick="removeEditServiceImage(${editServiceImageFiles.length - 1})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            previewContainer.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
    
    // Clear input
    event.target.value = '';
}

function removeEditServiceImage(index) {
    editServiceImageFiles.splice(index, 1);
    
    // Rebuild preview
    const previewContainer = document.getElementById('editImagePreviewContainer');
    previewContainer.innerHTML = '';
    
    editServiceImageFiles.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button class="remove-image" onclick="removeEditServiceImage(${idx})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            previewContainer.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
}

// Edit service form submission
document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('editServiceForm');
    if (editForm) {
        editForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const serviceId = document.getElementById('editServiceId').value;
            const formData = new FormData();
            formData.append('name', document.getElementById('editServiceName').value);
            formData.append('description', document.getElementById('editServiceDescription').value);
            formData.append('price', document.getElementById('editServicePrice').value);
            formData.append('duration', document.getElementById('editServiceDuration').value);
            
            // Add new images if any
            editServiceImageFiles.forEach((file) => {
                formData.append('images', file);
            });
            
            try {
                showNotification('Updating service...', 'info');
                const response = await authenticatedFetch(`${window.API_BASE_URL}/api/salons/services/${serviceId}/`, {
                    method: 'PUT',
                    body: formData,
                    isFormData: true
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showNotification('Service updated successfully!', 'success');
                    closeEditServiceModal();
                    loadServices(); // Reload services
                    
                    // Clear edit image files
                    editServiceImageFiles = [];
                    document.getElementById('editImagePreviewContainer').innerHTML = '';
                } else {
                    showNotification(data.error || 'Failed to update service', 'error');
                }
            } catch (error) {
                console.error('Error updating service:', error);
                showNotification('Network error. Please try again.', 'error');
            }
        });
    }
});

// Modal functions
function closeEditServiceModal() {
    document.getElementById('editServiceModal').style.display = 'none';
    editServiceImageFiles = [];
    document.getElementById('editImagePreviewContainer').innerHTML = '';
}

// Booking Details Modal
function viewBookingDetails(bookingId) {
    const booking = allBookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    // Get customer initials
    const nameParts = booking.customer.name.split(' ');
    const initials = nameParts.length > 1 
        ? nameParts[0][0] + nameParts[nameParts.length - 1][0]
        : nameParts[0][0];
    
    // Payment badge and icon
    let paymentBadge = '';
    let paymentIcon = '';
    if (booking.payment_status === 'completed') {
        paymentBadge = '<span class="payment-badge paid">PAID</span>';
        if (booking.payment_method === 'paypal') {
            paymentIcon = '<i class="fab fa-paypal" style="color: #0070ba; font-size: 1.5rem;" title="Paid with PayPal"></i>';
        } else if (booking.payment_method === 'stripe') {
            paymentIcon = '<i class="fas fa-credit-card" style="color: #6366f1; font-size: 1.5rem;" title="Paid with Credit Card"></i>';
        }
    } else if (booking.payment_method === 'pay_later') {
        paymentBadge = '<span class="payment-badge pay-later">PAY AT SALON</span>';
    } else {
        paymentBadge = '<span class="payment-badge pending">PENDING</span>';
    }
    
    // Service image
    const serviceImage = booking.service.images && booking.service.images.length > 0
        ? booking.service.images[0]
        : '/default-service.jpg';
    
    const content = `
        <div class="booking-details-modal-content">
            <h2><i class="fas fa-calendar-check"></i> Booking Details</h2>
            
            <div class="booking-detail-header">
                <div class="customer-detail-section">
                    <div class="customer-avatar-large">
                        ${booking.customer.profile_picture 
                            ? `<img src="${booking.customer.profile_picture}" alt="${booking.customer.name}">` 
                            : `<div class="avatar-initials-large">${initials.toUpperCase()}</div>`
                        }
                    </div>
                    <div>
                        <h3>${booking.customer.name}</h3>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                            ${paymentBadge}
                            ${paymentIcon}
                        </div>
                    </div>
                </div>
                <div class="status-badge-large status-${booking.status}">
                    ${booking.status.toUpperCase()}
                </div>
            </div>
            
            <div class="service-detail-card">
                <img src="${serviceImage}" alt="${booking.service.name}" class="service-detail-image">
                <div class="service-detail-info">
                    <h4><i class="fas fa-scissors"></i> ${booking.service.name}</h4>
                    <p class="service-price-large">₱${booking.price}</p>
                </div>
            </div>
            
            <div class="booking-info-grid">
                <div class="info-item">
                    <i class="fas fa-calendar"></i>
                    <div>
                        <span class="info-label">Date</span>
                        <span class="info-value">${new Date(booking.booking_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                </div>
                <div class="info-item">
                    <i class="fas fa-clock"></i>
                    <div>
                        <span class="info-label">Time</span>
                        <span class="info-value">${formatTime(booking.booking_time)}</span>
                    </div>
                </div>
                <div class="info-item">
                    <i class="fas fa-hourglass-half"></i>
                    <div>
                        <span class="info-label">Duration</span>
                        <span class="info-value">${booking.duration} minutes</span>
                    </div>
                </div>
                <div class="info-item">
                    <i class="fas fa-envelope"></i>
                    <div>
                        <span class="info-label">Email</span>
                        <span class="info-value">${booking.customer.email}</span>
                    </div>
                </div>
                <div class="info-item">
                    <i class="fas fa-phone"></i>
                    <div>
                        <span class="info-label">Phone</span>
                        <span class="info-value">${booking.customer.phone}</span>
                    </div>
                </div>
            </div>
            
            ${booking.notes ? `
                <div class="booking-notes-detail">
                    <i class="fas fa-note-sticky"></i>
                    <div>
                        <span class="info-label">Special Requests</span>
                        <p>${booking.notes}</p>
                    </div>
                </div>
            ` : ''}
            
            <div class="booking-actions-modal">
                ${booking.status === 'pending' ? `
                    <button class="btn-modal btn-confirm" onclick="confirmBookingFromModal(${booking.id})">
                        <i class="fas fa-check"></i> Confirm Booking
                    </button>
                    <button class="btn-modal btn-cancel" onclick="cancelBookingFromModal(${booking.id})">
                        <i class="fas fa-times"></i> Cancel Booking
                    </button>
                ` : booking.status === 'confirmed' ? `
                    <button class="btn-modal btn-confirm" onclick="completeBookingFromModal(${booking.id})">
                        <i class="fas fa-check-double"></i> Mark as Completed
                    </button>
                    <button class="btn-modal btn-cancel" onclick="cancelBookingFromModal(${booking.id})">
                        <i class="fas fa-times"></i> Cancel Booking
                    </button>
                ` : `
                    <div class="booking-status-final">
                        <i class="fas fa-info-circle"></i>
                        This booking is ${booking.status}
                    </div>
                `}
            </div>
        </div>
    `;
    
    document.getElementById('bookingDetailsContent').innerHTML = content;
    document.getElementById('bookingDetailsModal').style.display = 'flex';
}

function closeBookingDetailsModal() {
    document.getElementById('bookingDetailsModal').style.display = 'none';
}

async function confirmBookingFromModal(bookingId) {
    await updateBookingStatus(bookingId, 'confirmed');
    closeBookingDetailsModal();
}

async function completeBookingFromModal(bookingId) {
    await updateBookingStatus(bookingId, 'completed');
    closeBookingDetailsModal();
}

async function cancelBookingFromModal(bookingId) {
    if (confirm('Are you sure you want to cancel this booking?')) {
        await updateBookingStatus(bookingId, 'cancelled');
        closeBookingDetailsModal();
    }
}
