// Ensure API_BASE_URL is defined (fallback if config.js hasn't loaded yet)
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'https://web-production-e6265.up.railway.app';
    console.warn('⚠️ API_BASE_URL was undefined in admin-applications.js, using fallback:', window.API_BASE_URL);
}

let allApplications = [];
let currentFilter = 'all';

// Load applications on page load
document.addEventListener('DOMContentLoaded', function() {
    loadAdminData();
    loadApplications();
});

function loadAdminData() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    if (userData) {
        document.getElementById('adminName').textContent = userData.first_name || 'Admin';
    }
}

async function loadApplications() {
    try {
        const accessToken = localStorage.getItem('access_token');
        
        if (!accessToken) {
            window.location.href = '/';
            return;
        }
        
        const response = await fetch(`${window.API_BASE_URL}/api/salons/applications/`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            allApplications = await response.json();
            updateStats();
            filterApplications(currentFilter);
        } else {
            const error = await response.json();
            console.error('API Error:', error);
            
            // If unauthorized, redirect to login
            if (response.status === 401) {
                showNotification('Session expired. Please login again.', 'error');
                setTimeout(() => {
                    localStorage.clear();
                    window.location.href = '/';
                }, 2000);
                return;
            }
            
            showNotification('Failed to load applications: ' + (error.detail || error.error || 'Unknown error'), 'error');
            
            // Show empty state
            document.getElementById('applicationsContainer').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Failed to load applications</h3>
                    <p>Please try refreshing the page or contact support.</p>
                    <button class="btn-primary" onclick="loadApplications()">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading applications:', error);
        showNotification('Network error. Please try again.', 'error');
        
        // Show error state
        document.getElementById('applicationsContainer').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Network Error</h3>
                <p>Could not connect to the server. Please check your connection.</p>
                <button class="btn-primary" onclick="loadApplications()">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
    }
}

function updateStats() {
    const pending = allApplications.filter(app => app.status === 'pending').length;
    const approved = allApplications.filter(app => app.status === 'approved').length;
    const rejected = allApplications.filter(app => app.status === 'rejected').length;
    
    document.getElementById('pendingStats').textContent = pending;
    document.getElementById('approvedStats').textContent = approved;
    document.getElementById('rejectedStats').textContent = rejected;
    document.getElementById('totalStats').textContent = allApplications.length;
    
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('tabPending').textContent = pending;
    document.getElementById('tabApproved').textContent = approved;
    document.getElementById('tabRejected').textContent = rejected;
}

function filterApplications(status) {
    currentFilter = status;
    
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.status === status) {
            btn.classList.add('active');
        }
    });
    
    // Filter applications
    const filtered = status === 'all' 
        ? allApplications 
        : allApplications.filter(app => app.status === status);
    
    displayApplications(filtered);
}

function displayApplications(applications) {
    const container = document.getElementById('applicationsContainer');
    
    if (applications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No applications found</h3>
                <p>There are no ${currentFilter === 'all' ? '' : currentFilter} applications at the moment.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = applications.map(app => `
        <div class="application-card ${app.status}">
            <div class="app-header">
                <div class="app-info">
                    <h3>${app.salon_name}</h3>
                    <p class="app-meta">
                        <i class="fas fa-user"></i> ${app.applicant.name} 
                        <span class="separator">|</span>
                        <i class="fas fa-envelope"></i> ${app.applicant.email}
                    </p>
                    <p class="app-meta">
                        <i class="fas fa-map-marker-alt"></i> ${app.city}, ${app.state}
                        <span class="separator">|</span>
                        <i class="fas fa-calendar"></i> ${formatDate(app.created_at)}
                    </p>
                </div>
                <div class="app-status">
                    <span class="status-badge status-${app.status}">
                        <i class="fas fa-${getStatusIcon(app.status)}"></i>
                        ${app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                    </span>
                </div>
            </div>
            
            <div class="app-details">
                <div class="detail-item">
                    <i class="fas fa-phone"></i>
                    <span>${app.phone}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-briefcase"></i>
                    <span>${app.years_in_business} years in business</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-users"></i>
                    <span>${app.staff_count} staff members</span>
                </div>
            </div>
            
            <div class="app-services">
                ${app.services.map(service => `
                    <span class="service-tag">${service}</span>
                `).join('')}
            </div>
            
            <div class="app-actions">
                <button class="btn-view" onclick="viewApplication(${app.id})">
                    <i class="fas fa-eye"></i> View Details
                </button>
                ${app.status === 'pending' ? `
                    <button class="btn-approve" onclick="approveApplication(${app.id})">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn-reject" onclick="rejectApplication(${app.id})">
                        <i class="fas fa-times"></i> Reject
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function viewApplication(appId) {
    const app = allApplications.find(a => a.id === appId);
    if (!app) return;
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="application-detail">
            <div class="detail-header">
                <h2>${app.salon_name}</h2>
                <span class="status-badge status-${app.status}">
                    <i class="fas fa-${getStatusIcon(app.status)}"></i>
                    ${app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                </span>
            </div>
            
            <div class="detail-section">
                <h3><i class="fas fa-user"></i> Applicant Information</h3>
                <div class="detail-grid">
                    <div class="detail-field">
                        <label>Name:</label>
                        <span>${app.applicant.name}</span>
                    </div>
                    <div class="detail-field">
                        <label>Email:</label>
                        <span>${app.applicant.email}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3><i class="fas fa-building"></i> Salon Information</h3>
                <div class="detail-grid">
                    <div class="detail-field">
                        <label>Business Email:</label>
                        <span>${app.business_email}</span>
                    </div>
                    <div class="detail-field">
                        <label>Phone:</label>
                        <span>${app.phone}</span>
                    </div>
                    ${app.website ? `
                        <div class="detail-field">
                            <label>Website:</label>
                            <span><a href="${app.website}" target="_blank">${app.website}</a></span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="detail-section">
                <h3><i class="fas fa-map-marker-alt"></i> Location</h3>
                <div class="detail-grid">
                    <div class="detail-field full-width">
                        <label>Address:</label>
                        <span>${app.address}</span>
                    </div>
                    <div class="detail-field">
                        <label>City:</label>
                        <span>${app.city}</span>
                    </div>
                    <div class="detail-field">
                        <label>State:</label>
                        <span>${app.state}</span>
                    </div>
                    <div class="detail-field">
                        <label>Postal Code:</label>
                        <span>${app.postal_code}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3><i class="fas fa-scissors"></i> Services Offered</h3>
                <div class="services-list">
                    ${app.services.map(service => `
                        <span class="service-tag">${service}</span>
                    `).join('')}
                </div>
            </div>
            
            <div class="detail-section">
                <h3><i class="fas fa-info-circle"></i> Additional Details</h3>
                <div class="detail-grid">
                    <div class="detail-field">
                        <label>Years in Business:</label>
                        <span>${app.years_in_business}</span>
                    </div>
                    <div class="detail-field">
                        <label>Staff Count:</label>
                        <span>${app.staff_count}</span>
                    </div>
                    <div class="detail-field full-width">
                        <label>Description:</label>
                        <span>${app.description}</span>
                    </div>
                    ${app.application_reason ? `
                        <div class="detail-field full-width">
                            <label>Why join SalonBook:</label>
                            <span>${app.application_reason}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            ${app.status !== 'pending' ? `
                <div class="detail-section">
                    <h3><i class="fas fa-clipboard-check"></i> Review Information</h3>
                    <div class="detail-grid">
                        ${app.reviewed_by ? `
                            <div class="detail-field">
                                <label>Reviewed By:</label>
                                <span>${app.reviewed_by.name}</span>
                            </div>
                        ` : ''}
                        ${app.reviewed_at ? `
                            <div class="detail-field">
                                <label>Reviewed At:</label>
                                <span>${formatDate(app.reviewed_at)}</span>
                            </div>
                        ` : ''}
                        ${app.admin_notes ? `
                            <div class="detail-field full-width">
                                <label>Admin Notes:</label>
                                <span>${app.admin_notes}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            
            ${app.status === 'pending' ? `
                <div class="modal-actions">
                    <button class="btn-approve" onclick="approveApplication(${app.id})">
                        <i class="fas fa-check"></i> Approve Application
                    </button>
                    <button class="btn-reject" onclick="rejectApplication(${app.id})">
                        <i class="fas fa-times"></i> Reject Application
                    </button>
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('applicationModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeApplicationModal() {
    document.getElementById('applicationModal').classList.remove('show');
    document.body.style.overflow = 'auto';
}

async function approveApplication(appId) {
    if (!confirm('Are you sure you want to approve this application? An approval email will be sent to the applicant.')) {
        return;
    }
    
    const notes = prompt('Optional notes (will be sent in the approval email):');
    
    try {
        const accessToken = localStorage.getItem('access_token');
        
        const response = await fetch(`${window.API_BASE_URL}/api/salons/applications/${appId}/approve/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ notes: notes || '' })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Application approved successfully! Approval email sent.', 'success');
            closeApplicationModal();
            loadApplications(); // Reload applications
        } else {
            showNotification(data.error || 'Failed to approve application', 'error');
        }
        
    } catch (error) {
        console.error('Error approving application:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

async function rejectApplication(appId) {
    if (!confirm('Are you sure you want to reject this application?')) {
        return;
    }
    
    const notes = prompt('Reason for rejection (will be sent to applicant):');
    
    if (!notes) {
        showNotification('Please provide a reason for rejection', 'error');
        return;
    }
    
    try {
        const accessToken = localStorage.getItem('access_token');
        
        const response = await fetch(`${window.API_BASE_URL}/api/salons/applications/${appId}/reject/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ notes: notes })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Application rejected. Notification email sent.', 'success');
            closeApplicationModal();
            loadApplications(); // Reload applications
        } else {
            showNotification(data.error || 'Failed to reject application', 'error');
        }
        
    } catch (error) {
        console.error('Error rejecting application:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Helper functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusIcon(status) {
    const icons = {
        'pending': 'clock',
        'approved': 'check-circle',
        'rejected': 'times-circle'
    };
    return icons[status] || 'question-circle';
}

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
