let allSalons = [];

// Load salons on page load
document.addEventListener('DOMContentLoaded', function() {
    loadAdminData();
    loadSalons();
});

function loadAdminData() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    if (userData) {
        document.getElementById('userEmail').textContent = userData.email || 'admin@salon.com';
    }
}

async function loadSalons() {
    try {
        const accessToken = localStorage.getItem('access_token');
        
        if (!accessToken) {
            window.location.href = '/';
            return;
        }
        
        const response = await fetch('http://localhost:8000/api/salons/', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            allSalons = await response.json();
            updateStats();
            displaySalons();
        } else {
            showNotification('Failed to load salons', 'error');
        }
        
    } catch (error) {
        console.error('Error loading salons:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

function updateStats() {
    const total = allSalons.length;
    const active = allSalons.filter(salon => salon.is_active).length;
    const featured = allSalons.filter(salon => salon.is_featured).length;
    const verified = allSalons.filter(salon => salon.is_verified).length;
    
    document.getElementById('totalSalons').textContent = total;
    document.getElementById('activeSalons').textContent = active;
    document.getElementById('featuredSalons').textContent = featured;
    document.getElementById('verifiedSalons').textContent = verified;
}

function displaySalons() {
    const container = document.getElementById('salonsContainer');
    
    if (allSalons.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-store-slash"></i>
                <h3>No salons found</h3>
                <p>There are no registered salons yet.</p>
                <button class="btn-primary" onclick="window.location.href='/admin/applications'">
                    <i class="fas fa-file-alt"></i> View Applications
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = allSalons.map(salon => `
        <div class="salon-card-admin">
            <div class="salon-header">
                <div class="salon-title">
                    <h3>${salon.name}</h3>
                    <div class="salon-badges">
                        ${salon.is_verified ? '<span class="badge-verified"><i class="fas fa-certificate"></i> Verified</span>' : ''}
                        ${salon.is_featured ? '<span class="badge-featured"><i class="fas fa-star"></i> Featured</span>' : ''}
                        ${!salon.is_active ? '<span class="badge-inactive"><i class="fas fa-ban"></i> Inactive</span>' : ''}
                    </div>
                </div>
                <div class="salon-actions-quick">
                    <button class="btn-icon" onclick="viewSalon(${salon.id})" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon ${salon.is_active ? 'delete' : 'success'}" 
                            onclick="toggleSalonStatus(${salon.id})" 
                            title="${salon.is_active ? 'Deactivate' : 'Activate'} Salon">
                        <i class="fas fa-${salon.is_active ? 'ban' : 'check-circle'}"></i>
                    </button>
                </div>
            </div>
            
            <div class="salon-info">
                <div class="info-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${salon.city}, ${salon.state}</span>
                </div>
                <div class="info-item">
                    <i class="fas fa-envelope"></i>
                    <span>${salon.email}</span>
                </div>
                <div class="info-item">
                    <i class="fas fa-phone"></i>
                    <span>${salon.phone}</span>
                </div>
                <div class="info-item">
                    <i class="fas fa-user-tie"></i>
                    <span>${salon.staff_count} staff members</span>
                </div>
            </div>
            
            <div class="salon-stats">
                <div class="stat-item">
                    <i class="fas fa-star"></i>
                    <span>${salon.rating.toFixed(1)}</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-comment"></i>
                    <span>${salon.total_reviews} reviews</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-briefcase"></i>
                    <span>${salon.years_in_business}y experience</span>
                </div>
            </div>
            
            <div class="salon-services-preview">
                ${salon.services.slice(0, 3).map(service => `
                    <span class="service-tag-small">${service}</span>
                `).join('')}
                ${salon.services.length > 3 ? `<span class="service-more">+${salon.services.length - 3} more</span>` : ''}
            </div>
            
            <div class="salon-actions">
                <button class="btn-secondary" onclick="viewSalon(${salon.id})">
                    <i class="fas fa-eye"></i> View Details
                </button>
                <button class="btn-toggle ${salon.is_featured ? 'active' : ''}" 
                        onclick="toggleFeatured(${salon.id})">
                    <i class="fas fa-star"></i> ${salon.is_featured ? 'Unfeature' : 'Feature'}
                </button>
            </div>
        </div>
    `).join('');
}

function viewSalon(salonId) {
    const salon = allSalons.find(s => s.id === salonId);
    if (!salon) return;
    
    const modalBody = document.getElementById('salonModalBody');
    modalBody.innerHTML = `
        <div class="salon-detail">
            <div class="detail-header">
                <h2>${salon.name}</h2>
                <div class="salon-badges">
                    ${salon.is_verified ? '<span class="badge-verified"><i class="fas fa-certificate"></i> Verified</span>' : ''}
                    ${salon.is_featured ? '<span class="badge-featured"><i class="fas fa-star"></i> Featured</span>' : ''}
                    <span class="status-badge status-${salon.is_active ? 'approved' : 'rejected'}">
                        ${salon.is_active ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
            
            <div class="detail-section">
                <h3><i class="fas fa-building"></i> Basic Information</h3>
                <div class="detail-grid">
                    <div class="detail-field">
                        <label>Email:</label>
                        <span><a href="mailto:${salon.email}">${salon.email}</a></span>
                    </div>
                    <div class="detail-field">
                        <label>Phone:</label>
                        <span><a href="tel:${salon.phone}">${salon.phone}</a></span>
                    </div>
                    ${salon.website ? `
                        <div class="detail-field">
                            <label>Website:</label>
                            <span><a href="${salon.website}" target="_blank">${salon.website}</a></span>
                        </div>
                    ` : ''}
                    <div class="detail-field">
                        <label>Created:</label>
                        <span>${formatDate(salon.created_at)}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3><i class="fas fa-map-marker-alt"></i> Location</h3>
                <div class="detail-grid">
                    <div class="detail-field full-width">
                        <label>Address:</label>
                        <span>${salon.address}</span>
                    </div>
                    <div class="detail-field">
                        <label>City:</label>
                        <span>${salon.city}</span>
                    </div>
                    <div class="detail-field">
                        <label>State:</label>
                        <span>${salon.state}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3><i class="fas fa-info-circle"></i> Description</h3>
                <p>${salon.description}</p>
            </div>
            
            <div class="detail-section">
                <h3><i class="fas fa-scissors"></i> Services Offered</h3>
                <div class="services-list">
                    ${salon.services.map(service => `
                        <span class="service-tag">${service}</span>
                    `).join('')}
                </div>
            </div>
            
            <div class="detail-section">
                <h3><i class="fas fa-chart-line"></i> Statistics</h3>
                <div class="detail-grid">
                    <div class="detail-field">
                        <label>Rating:</label>
                        <span>${salon.rating.toFixed(1)} / 5.0 <i class="fas fa-star" style="color: #ffc107;"></i></span>
                    </div>
                    <div class="detail-field">
                        <label>Total Reviews:</label>
                        <span>${salon.total_reviews}</span>
                    </div>
                    <div class="detail-field">
                        <label>Years in Business:</label>
                        <span>${salon.years_in_business} years</span>
                    </div>
                    <div class="detail-field">
                        <label>Staff Count:</label>
                        <span>${salon.staff_count} members</span>
                    </div>
                </div>
            </div>
            
            <div class="modal-actions">
                <button class="btn-secondary" onclick="toggleFeatured(${salon.id})">
                    <i class="fas fa-star"></i> ${salon.is_featured ? 'Remove from Featured' : 'Mark as Featured'}
                </button>
                <button class="btn-secondary" onclick="toggleVerified(${salon.id})">
                    <i class="fas fa-certificate"></i> ${salon.is_verified ? 'Unverify' : 'Verify'} Salon
                </button>
                <button class="btn-${salon.is_active ? 'reject' : 'approve'}" onclick="toggleSalonStatus(${salon.id})">
                    <i class="fas fa-${salon.is_active ? 'ban' : 'check-circle'}"></i> ${salon.is_active ? 'Deactivate' : 'Activate'} Salon
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('salonModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeSalonModal() {
    document.getElementById('salonModal').classList.remove('show');
    document.body.style.overflow = 'auto';
}

async function toggleSalonStatus(salonId) {
    const salon = allSalons.find(s => s.id === salonId);
    if (!salon) return;
    
    const action = salon.is_active ? 'deactivate' : 'activate';
    
    if (!confirm(`Are you sure you want to ${action} "${salon.name}"?`)) {
        return;
    }
    
    try {
        showNotification(`${action === 'activate' ? 'Activating' : 'Deactivating'} salon...`, 'info');
        
        // Update salon status (you'll need to create this API endpoint)
        salon.is_active = !salon.is_active;
        
        showNotification(`Salon ${action}d successfully!`, 'success');
        closeSalonModal();
        displaySalons();
        updateStats();
        
    } catch (error) {
        console.error(`Error ${action}ing salon:`, error);
        showNotification(`Failed to ${action} salon`, 'error');
    }
}

async function toggleFeatured(salonId) {
    const salon = allSalons.find(s => s.id === salonId);
    if (!salon) return;
    
    try {
        salon.is_featured = !salon.is_featured;
        showNotification(`Salon ${salon.is_featured ? 'marked as featured' : 'removed from featured'}!`, 'success');
        closeSalonModal();
        displaySalons();
        updateStats();
        
    } catch (error) {
        console.error('Error toggling featured status:', error);
        showNotification('Failed to update featured status', 'error');
    }
}

async function toggleVerified(salonId) {
    const salon = allSalons.find(s => s.id === salonId);
    if (!salon) return;
    
    try {
        salon.is_verified = !salon.is_verified;
        showNotification(`Salon ${salon.is_verified ? 'verified' : 'unverified'} successfully!`, 'success');
        closeSalonModal();
        displaySalons();
        updateStats();
        
    } catch (error) {
        console.error('Error toggling verified status:', error);
        showNotification('Failed to update verified status', 'error');
    }
}

function refreshSalons() {
    showNotification('Refreshing salons...', 'info');
    loadSalons();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
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

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }
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
