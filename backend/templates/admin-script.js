// Admin Dashboard JavaScript

// Ensure API_BASE_URL is defined (fallback if config.js hasn't loaded yet)
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'https://web-production-e6265.up.railway.app';
    console.warn('⚠️ API_BASE_URL was undefined in admin-script.js, using fallback:', window.API_BASE_URL);
}

// Check if user is admin on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuth();
    loadDashboardData();
    loadUserInfo();
});

// Check if user is authenticated and is admin
function checkAdminAuth() {
    const token = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user_data');
    
    if (!token || !userData) {
        window.location.href = '/';
        return;
    }
    
    const user = JSON.parse(userData);
    if (!user.is_staff && !user.is_superuser) {
        alert('Access denied. Admin privileges required.');
        window.location.href = '/';
        return;
    }
}

// Load user information
function loadUserInfo() {
    const userData = localStorage.getItem('user_data');
    if (userData) {
        const user = JSON.parse(userData);
        document.getElementById('adminName').textContent = user.first_name || user.username;
        document.getElementById('userEmail').textContent = user.email;
    }
}

// Load dashboard statistics
async function loadDashboardData() {
    try {
        const token = localStorage.getItem('access_token');
        
        // Load users count
        const usersResponse = await fetch(`${window.API_BASE_URL}/api/auth/users/`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (usersResponse.ok) {
            const users = await usersResponse.json();
            document.getElementById('totalUsers').textContent = users.length || 0;
            displayRecentUsers(users.slice(-5)); // Show last 5 users
        }
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Set default values if API fails
        document.getElementById('totalUsers').textContent = '0';
        document.getElementById('totalSalons').textContent = '0';
        document.getElementById('totalBookings').textContent = '0';
        document.getElementById('totalRevenue').textContent = '₱0';
    }
}

// Display recent users in the table
function displayRecentUsers(users) {
    const tbody = document.getElementById('recentUsersTable');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.first_name} ${user.last_name}</td>
            <td>${user.email}</td>
            <td>
                <span class="user-type ${user.user_type}">
                    ${user.user_type === 'salon_owner' ? 'Salon Owner' : 'Customer'}
                </span>
            </td>
            <td>${formatDate(user.date_joined)}</td>
        </tr>
    `).join('');
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }
}

// Export data function
function exportData() {
    showNotification('Exporting data... This feature will be implemented soon.', 'info');
}

// Show system settings
function showSystemSettings() {
    showNotification('System settings panel will be implemented soon.', 'info');
}

// Notification system for admin
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.admin-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `admin-notification admin-notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Add navigation active state
function setActiveNav(page) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        const link = item.querySelector('.nav-link');
        if (link.href.includes(page)) {
            item.classList.add('active');
        }
    });
}

// Auto refresh dashboard data every 30 seconds
setInterval(() => {
    loadDashboardData();
}, 30000);

// Add notification styles dynamically
const adminNotificationStyles = `
    .admin-notification {
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 3000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 350px;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .admin-notification-success {
        background: linear-gradient(45deg, #48bb78, #38a169);
    }
    
    .admin-notification-error {
        background: linear-gradient(45deg, #f56565, #e53e3e);
    }
    
    .admin-notification-info {
        background: linear-gradient(45deg, #4299e1, #3182ce);
    }
    
    .admin-notification-warning {
        background: linear-gradient(45deg, #ed8936, #dd6b20);
    }
    
    .admin-notification button {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        margin-left: 1rem;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
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
    
    .user-type {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .user-type.customer {
        background: rgba(72, 187, 120, 0.1);
        color: #38a169;
    }
    
    .user-type.salon_owner {
        background: rgba(102, 126, 234, 0.1);
        color: #667eea;
    }
`;

// Add styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = adminNotificationStyles;
document.head.appendChild(styleSheet);
