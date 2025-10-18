// Shared Functions Across Multiple Pages

// Handle Salon Action (Apply for Salon or Go to Dashboard)
function handleSalonAction() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    
    if (!userData) {
        // Not logged in, redirect to login
        window.location.href = '/';
        return;
    }
    
    if (userData.user_type === 'salon_owner') {
        // Already a salon owner, redirect to dashboard
        window.location.href = '/salon/dashboard';
    } else {
        // Customer wants to apply, check if modal exists
        const modal = document.getElementById('salonApplicationModal');
        if (modal) {
            // Modal exists on this page, show it
            showSalonApplicationModal();
        } else {
            // Modal doesn't exist, redirect to home page with hash
            window.location.href = '/home#apply-salon';
        }
    }
}

// Show Salon Application Modal
function showSalonApplicationModal() {
    const modal = document.getElementById('salonApplicationModal');
    if (!modal) {
        console.warn('Salon application modal not found on this page');
        return;
    }
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Close Salon Application Modal
function closeSalonApplicationModal() {
    const modal = document.getElementById('salonApplicationModal');
    if (!modal) return;
    
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
    
    // Reset form if it exists
    const form = document.getElementById('salonApplicationForm');
    if (form) form.reset();
}

// Toggle User Menu (if not using navbar component)
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Logout Function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/';
    }
}

// Show Notification
function showNotification(message, type = 'info') {
    // Check if notification container exists
    let container = document.getElementById('notificationContainer');
    
    if (!container) {
        // Create container if it doesn't exist
        container = document.createElement('div');
        container.id = 'notificationContainer';
        container.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        background: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        gap: 1rem;
        min-width: 300px;
        animation: slideIn 0.3s ease;
        border-left: 4px solid ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
    `;
    
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    const color = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}" style="font-size: 1.2rem; color: ${color};"></i>
        <span style="flex: 1; color: #333;">${message}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; cursor: pointer; color: #999; font-size: 1.2rem;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Check if user is logged in
function checkAuth() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    const accessToken = localStorage.getItem('access_token');
    
    if (!userData || !accessToken) {
        window.location.href = '/';
        return false;
    }
    return true;
}

// Load user info into UI
function loadUserInfo() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    
    if (userData) {
        // Set user name
        const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'User';
        const userNameElements = document.querySelectorAll('.user-name, #userName');
        userNameElements.forEach(el => {
            if (el) el.textContent = fullName;
        });
        
        // Set user avatar initials
        const initials = `${userData.first_name?.charAt(0) || ''}${userData.last_name?.charAt(0) || ''}`.toUpperCase();
        const userAvatars = document.querySelectorAll('.user-avatar');
        userAvatars.forEach(avatar => {
            if (avatar && initials) {
                avatar.innerHTML = `<span style="font-size: 0.9rem; font-weight: bold;">${initials}</span>`;
            }
        });
        
        // Update salon action button if user is salon owner
        const salonBtn = document.getElementById('salonActionBtn');
        const salonBtnText = document.getElementById('salonBtnText');
        if (salonBtn && userData.user_type === 'salon_owner') {
            if (salonBtnText) salonBtnText.textContent = 'Manage Salon';
            salonBtn.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
        }
    }
}

// Initialize common functionality
document.addEventListener('DOMContentLoaded', function() {
    // Load user info if on authenticated page
    const userData = localStorage.getItem('user_data');
    if (userData) {
        loadUserInfo();
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        const userInfo = document.querySelector('.user-info');
        const dropdown = document.getElementById('userDropdown');
        
        if (userInfo && dropdown) {
            if (!userInfo.contains(event.target) && !dropdown.contains(event.target)) {
                dropdown.classList.remove('show');
            }
        }
    });
});

// Add CSS animation for notifications
if (!document.getElementById('notification-animations')) {
    const style = document.createElement('style');
    style.id = 'notification-animations';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}
