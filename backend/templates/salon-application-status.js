// Salon Application Status Page JavaScript

// Ensure API_BASE_URL is defined (fallback if config.js hasn't loaded yet)
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = '';
    console.warn('⚠️ API_BASE_URL was undefined in salon-application-status.js, using fallback:', window.API_BASE_URL);
}

// Token refresh function (from chat.js memory)
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
async function authenticatedFetch(url, options = {}) {
    let token = localStorage.getItem('access_token');
    
    if (!token) {
        window.location.href = '/';
        return;
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
            localStorage.clear();
            window.location.href = '/';
            return;
        }
    }

    return response;
}

// Load application status
async function loadApplicationStatus() {
    const loadingState = document.getElementById('loadingState');
    const applicationContent = document.getElementById('applicationContent');

    try {
        const response = await authenticatedFetch(`${window.API_BASE_URL}/api/salons/applications/my/`);

        if (!response.ok) {
            throw new Error('Failed to load application');
        }

        const data = await response.json();

        if (!data.has_application || !data.application) {
            // No application found, redirect to home
            window.location.href = '/home';
            return;
        }

        const app = data.application;

        // Hide loading, show content
        loadingState.style.display = 'none';
        applicationContent.style.display = 'block';

        // Update status header
        updateStatusHeader(app.status);

        // Populate application details
        populateApplicationDetails(app);

        // Build timeline
        buildTimeline(app);

        // Show admin notes if any
        if (app.admin_notes) {
            document.getElementById('adminNotesSection').style.display = 'block';
            document.getElementById('adminNotesText').textContent = app.admin_notes;
        }

        // Show reapply button if rejected
        if (app.status === 'rejected') {
            const reapplyBtn = document.getElementById('reapplyBtn');
            reapplyBtn.style.display = 'inline-flex';
            reapplyBtn.addEventListener('click', () => {
                window.location.href = '/home';
            });
        }

    } catch (error) {
        console.error('Error loading application:', error);
        loadingState.innerHTML = `
            <i class="fas fa-exclamation-triangle" style="color: #f44336;"></i>
            <p>Failed to load application status</p>
            <button class="btn btn-primary" onclick="window.location.reload()">
                <i class="fas fa-redo"></i> Retry
            </button>
        `;
    }
}

// Update status header based on status
function updateStatusHeader(status) {
    const statusIcon = document.getElementById('statusIcon');
    const statusTitle = document.getElementById('statusTitle');
    const statusSubtitle = document.getElementById('statusSubtitle');
    const statusBadge = document.getElementById('statusBadge');

    // Remove all status classes
    statusIcon.classList.remove('pending', 'approved', 'rejected');
    statusBadge.classList.remove('pending', 'approved', 'rejected');

    switch (status) {
        case 'pending':
            statusIcon.classList.add('pending');
            statusIcon.innerHTML = '<i class="fas fa-clock"></i>';
            statusTitle.textContent = 'Application Under Review';
            statusSubtitle.textContent = 'We\'re reviewing your application. This typically takes 2-3 business days.';
            statusBadge.classList.add('pending');
            statusBadge.textContent = 'Pending Review';
            break;

        case 'approved':
            statusIcon.classList.add('approved');
            statusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
            statusTitle.textContent = 'Application Approved!';
            statusSubtitle.textContent = 'Congratulations! Your salon has been approved. You can now manage your salon.';
            statusBadge.classList.add('approved');
            statusBadge.textContent = 'Approved';
            break;

        case 'rejected':
            statusIcon.classList.add('rejected');
            statusIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
            statusTitle.textContent = 'Application Not Approved';
            statusSubtitle.textContent = 'Unfortunately, your application was not approved at this time. Please review the admin notes below.';
            statusBadge.classList.add('rejected');
            statusBadge.textContent = 'Rejected';
            break;
    }
}

// Populate application details
function populateApplicationDetails(app) {
    // Salon Information
    document.getElementById('salonName').textContent = app.salon_name || '-';
    document.getElementById('businessEmail').textContent = app.business_email || '-';
    document.getElementById('phone').textContent = app.phone || '-';
    document.getElementById('website').textContent = app.website || 'Not provided';

    // Location
    document.getElementById('address').textContent = app.address || '-';
    document.getElementById('city').textContent = app.city || '-';
    document.getElementById('state').textContent = app.state || '-';
    document.getElementById('postalCode').textContent = app.postal_code || '-';

    // Services
    const servicesList = document.getElementById('servicesList');
    servicesList.innerHTML = '';
    if (app.services && app.services.length > 0) {
        app.services.forEach(service => {
            const serviceTag = document.createElement('span');
            serviceTag.className = 'service-tag';
            serviceTag.textContent = formatServiceName(service);
            servicesList.appendChild(serviceTag);
        });
    } else {
        servicesList.innerHTML = '<span class="detail-value">No services specified</span>';
    }

    // Additional Details
    document.getElementById('description').textContent = app.description || '-';
    document.getElementById('yearsInBusiness').textContent = app.years_in_business || '-';
    document.getElementById('staffCount').textContent = app.staff_count || '-';
    
    const reasonRow = document.getElementById('reasonRow');
    if (app.application_reason) {
        document.getElementById('applicationReason').textContent = app.application_reason;
    } else {
        reasonRow.style.display = 'none';
    }
}

// Build timeline
function buildTimeline(app) {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '';

    // Submitted
    addTimelineItem(timeline, formatDate(app.created_at), 'Application Submitted', true);

    // Reviewed (if applicable)
    if (app.reviewed_at) {
        const reviewText = app.status === 'approved' ? 'Application Approved' : 'Application Reviewed';
        addTimelineItem(timeline, formatDate(app.reviewed_at), reviewText, true);
    }

    // Next steps (if pending)
    if (app.status === 'pending') {
        addTimelineItem(timeline, 'Pending', 'Awaiting admin review', false);
    }
}

// Add timeline item
function addTimelineItem(container, date, content, completed) {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    if (!completed) {
        item.style.opacity = '0.5';
    }
    
    item.innerHTML = `
        <div class="timeline-date">${date}</div>
        <div class="timeline-content">${content}</div>
    `;
    
    container.appendChild(item);
}

// Format service name
function formatServiceName(service) {
    const serviceNames = {
        'haircut': 'Haircut & Styling',
        'coloring': 'Hair Coloring',
        'spa': 'Spa & Facial',
        'nails': 'Manicure & Pedicure',
        'makeup': 'Makeup',
        'bridal': 'Bridal Services',
        'massage': 'Massage',
        'waxing': 'Waxing'
    };
    
    return serviceNames[service] || service.charAt(0).toUpperCase() + service.slice(1);
}

// Format date
function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    return date.toLocaleDateString('en-US', options);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadApplicationStatus();
});
