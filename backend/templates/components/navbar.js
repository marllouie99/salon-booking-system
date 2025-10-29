// Shared Navigation Bar JavaScript

// Ensure API_BASE_URL is defined (fallback if config.js hasn't loaded yet)
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'https://web-production-e6265.up.railway.app';
    console.warn('⚠️ API_BASE_URL was undefined, using fallback:', window.API_BASE_URL);
}

// Load navigation bar
function loadNavbar() {
    // Get user data
    const userData = JSON.parse(localStorage.getItem('user_data'));
    
    if (userData) {
        // Set user name
        const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'User';
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = fullName;
        }

        // Set user avatar - check if user has uploaded photo first
        const userAvatar = document.querySelector('.user-avatar');
        if (userAvatar) {
            const profilePicture = userData.profile_picture;
            
            if (profilePicture) {
                // User has uploaded avatar - display image
                const avatarUrl = profilePicture.startsWith('http') 
                    ? profilePicture 
                    : `${window.API_BASE_URL}${profilePicture}`;
                userAvatar.innerHTML = `
                    <img src="${avatarUrl}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                    <span class="profile-warning-badge" id="avatarWarningBadge" style="display: none;">
                        <i class="fas fa-exclamation"></i>
                    </span>
                `;
            } else {
                // Show initials as fallback
                const initials = `${userData.first_name?.charAt(0) || ''}${userData.last_name?.charAt(0) || ''}`.toUpperCase();
                if (initials) {
                    userAvatar.innerHTML = `
                        <span style="font-size: 0.9rem; font-weight: bold;">${initials}</span>
                        <span class="profile-warning-badge" id="avatarWarningBadge" style="display: none;">
                            <i class="fas fa-exclamation"></i>
                        </span>
                    `;
                }
            }
        }

        // Check for salon application status
        checkSalonApplicationStatus(userData);
        
        // Check profile completion and show warning badges
        checkProfileCompletionForNavbar(userData);
        
        // Load existing notifications
        loadExistingNotifications();
    }

    // Highlight active page
    highlightActivePage();
}

// Load existing notifications from API
async function loadExistingNotifications() {
    try {
        const response = await authenticatedFetchNavbar(`${window.API_BASE_URL}/api/notifications/`);
        
        if (!response || !response.ok) {
            console.log('Could not load notifications');
            return;
        }
        
        const notifications = await response.json();
        
        // Store in localStorage for offline access
        localStorage.setItem('salon_notifications', JSON.stringify(notifications));
        
        if (notifications.length > 0) {
            // Count only unread notifications for badge
            const unreadCount = notifications.filter(n => !n.is_read).length;
            
            // Show badge with unread count
            const badge = document.getElementById('notificationBadge');
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
            
            // Render notifications
            renderNotifications();
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        // Fallback to localStorage
        const notifications = JSON.parse(localStorage.getItem('salon_notifications') || '[]');
        if (notifications.length > 0) {
            renderNotifications();
        }
    }
}

// Token refresh function (from chat.js pattern)
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    const response = await fetch(`${window.API_BASE_URL}/api/accounts/token/refresh/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh: refreshToken })
    });

    if (!response.ok) {
        throw new Error('Token refresh failed');
    }

    const data = await response.json();
    localStorage.setItem('access_token', data.access);
    return data.access;
}

// Authenticated fetch with automatic token refresh
async function authenticatedFetchNavbar(url, options = {}) {
    let token = localStorage.getItem('access_token');
    
    if (!token) {
        return null;
    }

    // Add authorization header
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    let response = await fetch(url, options);

    // If 401, try refreshing token
    if (response.status === 401) {
        try {
            token = await refreshAccessToken();
            options.headers['Authorization'] = `Bearer ${token}`;
            response = await fetch(url, options);
        } catch (error) {
            console.error('Token refresh failed:', error);
            return null;
        }
    }

    return response;
}

// Check salon application status and update button
async function checkSalonApplicationStatus(userData) {
    const salonBtn = document.getElementById('salonActionBtn');
    const salonBtnText = document.getElementById('salonBtnText');
    
    if (!salonBtn || !salonBtnText) return;
    
    // If user is already a salon owner
    if (userData.user_type === 'salon_owner') {
        salonBtnText.textContent = 'Manage Salon';
        salonBtn.classList.add('salon-owner');
        return;
    }
    
    // Check if user has a pending application
    try {
        const response = await authenticatedFetchNavbar(`${window.API_BASE_URL}/api/salons/applications/my/`);
        
        if (!response) return; // Token refresh failed or no token
        
        // Only process if request was successful
        if (response.ok) {
            const data = await response.json();
            
            if (data.has_application && data.application) {
                const status = data.application.status;
                
                if (status === 'pending') {
                    salonBtnText.innerHTML = '<i class="fas fa-clock"></i> Pending Application';
                    salonBtn.classList.add('pending-application');
                    salonBtn.style.background = 'linear-gradient(135deg, #ffc107, #ff9800)';
                } else if (status === 'rejected') {
                    salonBtnText.innerHTML = '<i class="fas fa-times-circle"></i> Application Rejected';
                    salonBtn.classList.add('rejected-application');
                    salonBtn.style.background = 'linear-gradient(135deg, #f44336, #e91e63)';
                } else if (status === 'approved') {
                    // Application approved - change to Manage Salon
                    salonBtnText.innerHTML = '<i class="fas fa-store"></i> Manage Salon';
                    salonBtn.classList.add('salon-owner');
                    salonBtn.style.background = 'linear-gradient(135deg, #4caf50, #8bc34a)';
                    
                    // Update user type in localStorage
                    const userData = JSON.parse(localStorage.getItem('user_data'));
                    if (userData && userData.user_type !== 'salon_owner') {
                        userData.user_type = 'salon_owner';
                        localStorage.setItem('user_data', JSON.stringify(userData));
                    }
                }
                
                // Check for notifications
                checkApplicationNotifications(data.application);
            }
        } else if (response.status === 404) {
            // 404 is expected if endpoint doesn't exist or no application found
            // Silently ignore
            return;
        }
    } catch (error) {
        // Network errors or other issues - silently ignore
        // User can still apply for salon even if status check fails
        return;
    }
}

// Check for application status notifications (now handled by backend)
function checkApplicationNotifications(application) {
    // Notifications are now created by the backend when status changes
    // Just reload notifications from API
    loadExistingNotifications();
}

// Show notification badge
function showNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        const currentCount = parseInt(badge.textContent) || 0;
        badge.textContent = currentCount + 1;
        badge.style.display = 'flex';
    }
}

// Add notification to list (legacy function - now notifications come from API)
function addNotificationToList(notification) {
    // Reload notifications from API
    loadExistingNotifications();
}

// Render notifications
function renderNotifications() {
    const notificationList = document.getElementById('notificationList');
    if (!notificationList) return;
    
    const notifications = JSON.parse(localStorage.getItem('salon_notifications') || '[]');
    
    if (notifications.length === 0) {
        notificationList.innerHTML = `
            <div class="no-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications</p>
            </div>
        `;
        return;
    }
    
    notificationList.innerHTML = notifications.map(notif => {
        // Map notification_type to icon type
        let iconType = 'info';
        if (notif.notification_type === 'application_approved') iconType = 'success';
        else if (notif.notification_type === 'application_rejected') iconType = 'error';
        
        return `
            <div class="notification-item ${iconType} ${notif.is_read ? 'read' : 'unread'}" onclick="handleNotificationClick(${notif.id}, '${notif.action_url || ''}')">
                <div class="notification-icon">
                    ${iconType === 'success' ? '<i class="fas fa-check-circle"></i>' : 
                      iconType === 'error' ? '<i class="fas fa-times-circle"></i>' : 
                      '<i class="fas fa-info-circle"></i>'}
                </div>
                <div class="notification-content">
                    <p><strong>${notif.title}</strong></p>
                    <p>${notif.message}</p>
                    <span class="notification-time">${formatNotificationTime(notif.created_at)}</span>
                </div>
                ${!notif.is_read ? '<div class="unread-indicator"></div>' : ''}
            </div>
        `;
    }).join('');
}

// Format notification time
function formatNotificationTime(timestamp) {
    if (!timestamp) return 'Just now';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
}

// Toggle notifications dropdown
function toggleNotifications() {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Handle notification click
async function handleNotificationClick(notificationId, actionUrl) {
    try {
        // Mark notification as read
        await authenticatedFetchNavbar(`${window.API_BASE_URL}/api/notifications/${notificationId}/mark_read/`, {
            method: 'POST'
        });
        
        // Reload notifications
        await loadExistingNotifications();
        
        // Redirect to action URL if provided
        if (actionUrl) {
            window.location.href = actionUrl;
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
        // Still redirect even if marking as read fails
        if (actionUrl) {
            window.location.href = actionUrl;
        }
    }
}

// Mark all notifications as read
async function markAllNotificationsRead() {
    try {
        const response = await authenticatedFetchNavbar(`${window.API_BASE_URL}/api/notifications/mark_all_read/`, {
            method: 'POST'
        });
        
        if (response && response.ok) {
            // Hide badge
            const badge = document.getElementById('notificationBadge');
            if (badge) {
                badge.style.display = 'none';
                badge.textContent = '0';
            }
            
            // Reload notifications from API
            await loadExistingNotifications();
        }
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
    
    toggleNotifications();
}

// Check profile completion for navbar badges
function checkProfileCompletionForNavbar(userData) {
    const isIncomplete = !userData.phone || !userData.address || 
                         !userData.first_name || !userData.last_name;
    
    const avatarBadge = document.getElementById('avatarWarningBadge');
    const profileBadge = document.getElementById('profileWarningBadge');
    
    if (isIncomplete) {
        if (avatarBadge) avatarBadge.style.display = 'flex';
        if (profileBadge) profileBadge.style.display = 'flex';
    } else {
        if (avatarBadge) avatarBadge.style.display = 'none';
        if (profileBadge) profileBadge.style.display = 'none';
    }
}

// Highlight active page in navigation
function highlightActivePage() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const onclick = link.getAttribute('onclick');
        if (onclick) {
            if ((currentPath.includes('customer-home') || currentPath.includes('/home')) && onclick.includes('customer-home')) {
                link.classList.add('active');
            } else if (currentPath.includes('my-bookings') && onclick.includes('my-bookings')) {
                link.classList.add('active');
            }
        }
    });

    // Highlight active dropdown item
    const dropdownLinks = document.querySelectorAll('.user-dropdown a');
    dropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && currentPath.includes(href)) {
            link.classList.add('active');
        }
    });
}

// Toggle user menu
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const userInfo = document.querySelector('.user-info');
    const dropdown = document.getElementById('userDropdown');
    
    if (userInfo && dropdown) {
        if (!userInfo.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.remove('show');
        }
    }
    
    // Close notification dropdown when clicking outside
    const notificationBell = document.getElementById('notificationBell');
    const notificationDropdown = document.getElementById('notificationDropdown');
    
    if (notificationBell && notificationDropdown) {
        if (!notificationBell.contains(event.target) && !notificationDropdown.contains(event.target)) {
            notificationDropdown.classList.remove('show');
        }
    }
});

// Handle Salon Action (Apply or Manage)
async function handleSalonAction() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    
    if (!userData) {
        window.location.href = '/';
        return;
    }
    
    if (userData.user_type === 'salon_owner') {
        // Redirect to salon dashboard
        window.location.href = '/salon-owner-dashboard.html';
        return;
    }
    
    // If already on status page, just reload
    if (window.location.pathname.includes('salon-application-status')) {
        window.location.reload();
        return;
    }
    
    // Check if user has an existing application
    try {
        const response = await authenticatedFetchNavbar(`${window.API_BASE_URL}/api/salons/applications/my/`);
        
        if (response && response.ok) {
            const data = await response.json();
            
            if (data.has_application && data.application) {
                const status = data.application.status;
                
                // If approved, redirect to salon dashboard
                if (status === 'approved') {
                    window.location.href = '/salon-owner-dashboard.html';
                    return;
                }
                
                // Otherwise, redirect to status page
                window.location.href = '/salon-application-status.html';
                return;
            }
        }
    } catch (error) {
        console.error('Error checking application:', error);
    }
    
    // Show modal if no application exists
    showSalonApplicationModal();
}

// Flag to prevent duplicate profile checks
let profileCheckInitialized = false;

// Check profile completion and disable submit button if incomplete
function checkProfileForSubmission(userData) {
    // Prevent duplicate checks
    if (profileCheckInitialized) {
        return;
    }
    
    const submitBtn = document.querySelector('#salonApplicationForm button[type="submit"]');
    const formActions = document.querySelector('.form-actions');
    
    if (!submitBtn || !formActions) {
        return; // Elements not ready yet
    }
    
    // Mark as initialized
    profileCheckInitialized = true;
    
    const isIncomplete = !userData?.phone || !userData?.address || 
                         !userData?.first_name || !userData?.last_name;

    // Remove any existing warning to avoid duplicates
    const existingWarning = document.querySelector('.form-submission-warning');
    if (existingWarning) {
        existingWarning.remove();
    }

    if (isIncomplete) {
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';
        
        // Add warning message above form actions (buttons)
        const warningDiv = document.createElement('div');
        warningDiv.className = 'form-submission-warning';
        warningDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>Complete your profile to submit</span>
            <a href="/profile.html" class="btn-complete-profile-small">Go to Profile</a>
        `;
        formActions.parentElement.insertBefore(warningDiv, formActions);
        
        // Add click handler to show notification
        submitBtn.addEventListener('click', function onClick(e) {
            if (submitBtn.disabled) {
                e.preventDefault();
                if (typeof showNotification === 'function') {
                    showNotification('Please complete your profile (name, phone, address) before submitting.', 'error');
                } else {
                    alert('Please complete your profile before submitting.');
                }
            }
        }, { once: true });
    } else {
        // Enable submit if profile is complete
        submitBtn.disabled = false;
        submitBtn.style.opacity = '';
        submitBtn.style.cursor = '';
    }
}

// Show Salon Application Modal
function showSalonApplicationModal() {
    const modal = document.getElementById('salonApplicationModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Reset flag and check profile when modal is shown
        profileCheckInitialized = false;
        const userData = JSON.parse(localStorage.getItem('user_data'));
        if (userData) {
            // Use MutationObserver to wait for form elements
            waitForModalElements(() => {
                checkProfileForSubmission(userData);
                
                // Initialize location selects now that modal is visible
                if (typeof initializePhilippineLocationSelects === 'function') {
                    initializePhilippineLocationSelects();
                    console.log('✓ Location selects initialized');
                }
            });
        }
    } else {
        console.error('Salon application modal not found');
    }
}

// Close Salon Application Modal
function closeSalonApplicationModal() {
    const modal = document.getElementById('salonApplicationModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
        // Reset form and flag
        const form = document.getElementById('salonApplicationForm');
        if (form) form.reset();
        profileCheckInitialized = false;
    }
}

// Wait for modal elements using MutationObserver (more efficient than polling)
function waitForModalElements(callback) {
    const submitBtn = document.querySelector('#salonApplicationForm button[type="submit"]');
    const formActions = document.querySelector('.form-actions');
    
    if (submitBtn && formActions) {
        // Elements already exist
        callback();
        return;
    }
    
    // Watch for elements to be added
    const observer = new MutationObserver((mutations, obs) => {
        const submitBtn = document.querySelector('#salonApplicationForm button[type="submit"]');
        const formActions = document.querySelector('.form-actions');
        
        if (submitBtn && formActions) {
            obs.disconnect();
            callback();
        }
    });
    
    // Observe the modal container
    const modalContainer = document.getElementById('salonModalContainer');
    if (modalContainer) {
        observer.observe(modalContainer, {
            childList: true,
            subtree: true
        });
        
        // Timeout after 3 seconds
        setTimeout(() => {
            observer.disconnect();
        }, 3000);
    }
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/';
    }
}

// Load salon application modal on all pages
function loadSalonApplicationModal() {
    // Add cache-busting parameter to force fresh load
    const cacheBuster = '?v=' + Date.now();
    console.log('Loading salon modal from:', '/static/components/salon-application-modal.html' + cacheBuster);

    // Ensure shared modal stylesheet is present once across all pages
    if (!document.getElementById('salonModalStyles')) {
        const link = document.createElement('link');
        link.id = 'salonModalStyles';
        link.rel = 'stylesheet';
        link.href = '/static/components/salon-application-modal.css' + cacheBuster;
        document.head.appendChild(link);
    }

    // Load scripts sequentially to ensure proper loading order
    loadScriptsSequentially()
        .then(() => {
            // Load modal HTML after scripts are ready
            return fetch('/static/components/salon-application-modal.html' + cacheBuster);
        })
        .then(response => {
            console.log('Modal fetch response:', response.status);
            return response.text();
        })
        .then(html => {
            console.log('Modal HTML loaded, length:', html.length);
            
            // Check if modal container exists
            let container = document.getElementById('salonModalContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'salonModalContainer';
                document.body.appendChild(container);
            }
            container.innerHTML = html;
            
            console.log('Modal injected into DOM');
            
            // Verify modal exists
            const modal = document.getElementById('salonApplicationModal');
            if (modal) {
                console.log('✓ Modal found in DOM');
            } else {
                console.error('✗ Modal NOT found in DOM after injection');
            }
            
            // Initialize form submission handler after modal is loaded
            initializeSalonApplicationForm();
            
            // Note: Location selects will be initialized when modal is shown
            // See showSalonApplicationModal() function
        })
        .catch(error => console.error('Error loading salon modal:', error));
}

// Load scripts sequentially
function loadScriptsSequentially() {
    return new Promise((resolve) => {
        // Load Philippine locations data first
        if (!document.getElementById('philippineLocationsScript')) {
            const locationsScript = document.createElement('script');
            locationsScript.id = 'philippineLocationsScript';
            locationsScript.src = '/static/data/philippines-locations.js';
            
            locationsScript.onload = () => {
                console.log('✓ Philippine locations data loaded');
                
                // Load searchable select component after locations data
                if (!document.getElementById('searchableSelectScript')) {
                    const searchableScript = document.createElement('script');
                    searchableScript.id = 'searchableSelectScript';
                    searchableScript.src = '/static/components/searchable-select.js';
                    
                    searchableScript.onload = () => {
                        console.log('✓ Searchable select component loaded');
                        resolve();
                    };
                    
                    searchableScript.onerror = () => {
                        console.error('✗ Failed to load searchable select component');
                        resolve(); // Resolve anyway to continue
                    };
                    
                    document.head.appendChild(searchableScript);
                } else {
                    resolve();
                }
            };
            
            locationsScript.onerror = () => {
                console.error('✗ Failed to load Philippine locations data');
                resolve(); // Resolve anyway to continue
            };
            
            document.head.appendChild(locationsScript);
        } else {
            resolve();
        }
    });
}

// Initialize salon application form submission
function initializeSalonApplicationForm() {
    const form = document.getElementById('salonApplicationForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = {
            salonName: document.getElementById('salonName')?.value,
            businessEmail: document.getElementById('businessEmail')?.value,
            salonPhone: document.getElementById('salonPhone')?.value,
            salonWebsite: document.getElementById('salonWebsite')?.value,
            salonAddress: document.getElementById('salonAddress')?.value,
            salonCity: document.getElementById('salonCity')?.value,
            salonState: document.getElementById('salonState')?.value,
            salonPostal: document.getElementById('salonPostal')?.value,
            salonDescription: document.getElementById('salonDescription')?.value,
            yearsInBusiness: document.getElementById('yearsInBusiness')?.value,
            staffCount: document.getElementById('staffCount')?.value,
            applicationReason: document.getElementById('applicationReason')?.value,
            services: []
        };
        
        // Get selected services
        const serviceCheckboxes = document.querySelectorAll('input[name="services"]:checked');
        serviceCheckboxes.forEach(checkbox => {
            formData.services.push(checkbox.value);
        });
        
        // Validate services
        if (formData.services.length === 0) {
            if (typeof showNotification === 'function') {
                showNotification('Please select at least one service', 'error');
            } else {
                alert('Please select at least one service');
            }
            return;
        }
        
        // Check terms agreement
        if (!document.getElementById('agreeTerms')?.checked) {
            if (typeof showNotification === 'function') {
                showNotification('Please agree to the terms and conditions', 'error');
            } else {
                alert('Please agree to the terms and conditions');
            }
            return;
        }
        
        try {
            if (typeof showNotification === 'function') {
                showNotification('Submitting your application...', 'info');
            }
            
            // Send to backend with authenticated fetch
            const response = await authenticatedFetchNavbar(`${window.API_BASE_URL}/api/salons/apply/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (!response) {
                throw new Error('Please login to submit application');
            }
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to submit application');
            }
            
            if (typeof showNotification === 'function') {
                showNotification('Application submitted successfully! We will review it and contact you soon.', 'success');
            } else {
                alert('Application submitted successfully!');
            }
            
            closeSalonApplicationModal();
            
            // Redirect to application summary page
            setTimeout(() => {
                window.location.href = '/salon-application-status.html';
            }, 1500);
            
        } catch (error) {
            console.error('Application submission error:', error);
            if (typeof showNotification === 'function') {
                showNotification(error.message || 'Failed to submit application. Please try again.', 'error');
            } else {
                alert(error.message || 'Failed to submit application. Please try again.');
            }
        }
    });
}

// Load navbar on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadNavbar();
        
        // Don't load modal on status page (it's not needed there)
        const isStatusPage = window.location.pathname.includes('salon-application-status');
        if (!isStatusPage) {
            loadSalonApplicationModal();
        }
    });
} else {
    loadNavbar();
    
    // Don't load modal on status page (it's not needed there)
    const isStatusPage = window.location.pathname.includes('salon-application-status');
    if (!isStatusPage) {
        loadSalonApplicationModal();
    }
}
