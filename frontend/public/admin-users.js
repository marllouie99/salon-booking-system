// Admin Users Management JavaScript

let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
const usersPerPage = 10;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Users page loaded');
    checkAdminAuth();
    loadUserInfo();
    loadAllUsers();
});

// Check if user is authenticated and is admin
function checkAdminAuth() {
    console.log('Checking admin auth...');
    const token = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user_data');
    
    console.log('Auth check - Token:', token ? 'Present' : 'Missing');
    console.log('Auth check - User data:', userData ? 'Present' : 'Missing');
    
    if (!token || !userData) {
        console.log('No auth data found, redirecting to home');
        window.location.href = '/';
        return;
    }
    
    const user = JSON.parse(userData);
    console.log('User info:', user);
    
    if (!user.is_staff && !user.is_superuser) {
        console.log('User is not admin, access denied');
        alert('Access denied. Admin privileges required.');
        window.location.href = '/';
        return;
    }
    
    console.log('Admin auth successful');
}

// Load user information
function loadUserInfo() {
    const userData = localStorage.getItem('user_data');
    if (userData) {
        const user = JSON.parse(userData);
        const nameElement = document.getElementById('adminName');
        const emailElement = document.getElementById('userEmail');
        
        if (nameElement) nameElement.textContent = user.first_name || user.username;
        if (emailElement) emailElement.textContent = user.email;
    }
}

// Load all users from API
async function loadAllUsers() {
    try {
        console.log('Loading users...');
        const token = localStorage.getItem('access_token');
        console.log('Token:', token ? 'Found' : 'Not found');
        
        const response = await fetch('http://localhost:8000/api/accounts/users/', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            allUsers = await response.json();
            console.log('Users loaded:', allUsers.length, allUsers);
            filteredUsers = [...allUsers];
            updateUserStatistics();
            displayUsers();
            createPagination();
        } else {
            console.log('API failed, using sample data for demo');
            // Use sample data for demo purposes
            allUsers = [
                {
                    id: 1,
                    first_name: 'Admin',
                    last_name: 'User',
                    email: 'admin@salon.com',
                    phone: '+1234567890',
                    user_type: 'admin',
                    is_active: true,
                    is_staff: true,
                    is_superuser: true,
                    date_joined: new Date().toISOString()
                },
                {
                    id: 2,
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john@example.com',
                    phone: '+1234567891',
                    user_type: 'customer',
                    is_active: true,
                    is_staff: false,
                    is_superuser: false,
                    date_joined: new Date(Date.now() - 86400000).toISOString()
                },
                {
                    id: 3,
                    first_name: 'Jane',
                    last_name: 'Smith',
                    email: 'jane@salon.com',
                    phone: '+1234567892',
                    user_type: 'salon_owner',
                    is_active: true,
                    is_staff: false,
                    is_superuser: false,
                    date_joined: new Date(Date.now() - 172800000).toISOString()
                }
            ];
            filteredUsers = [...allUsers];
            updateUserStatistics();
            displayUsers();
            createPagination();
        }
        
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Using sample data for demonstration', 'info');
        
        // Use sample data when API fails
        allUsers = [
            {
                id: 1,
                first_name: 'Admin',
                last_name: 'User',
                email: 'admin@salon.com',
                phone: '+1234567890',
                user_type: 'admin',
                is_active: true,
                is_staff: true,
                is_superuser: true,
                date_joined: new Date().toISOString()
            },
            {
                id: 2,
                first_name: 'John',
                last_name: 'Doe',
                email: 'john@example.com',
                phone: '+1234567891',
                user_type: 'customer',
                is_active: true,
                is_staff: false,
                is_superuser: false,
                date_joined: new Date(Date.now() - 86400000).toISOString()
            }
        ];
        filteredUsers = [...allUsers];
        updateUserStatistics();
        displayUsers();
        createPagination();
    }
}

// Update user statistics
function updateUserStatistics() {
    const totalUsers = allUsers.length;
    const customers = allUsers.filter(user => user.user_type === 'customer').length;
    const salonOwners = allUsers.filter(user => user.user_type === 'salon_owner').length;
    const admins = allUsers.filter(user => user.is_staff || user.is_superuser).length;
    
    document.getElementById('totalUsersCount').textContent = totalUsers;
    document.getElementById('customersCount').textContent = customers;
    document.getElementById('salonOwnersCount').textContent = salonOwners;
    document.getElementById('adminsCount').textContent = admins;
}

// Display users in table
function displayUsers() {
    const tbody = document.getElementById('usersTableBody');
    const start = (currentPage - 1) * usersPerPage;
    const end = start + usersPerPage;
    const paginatedUsers = filteredUsers.slice(start, end);
    
    if (paginatedUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = paginatedUsers.map(user => `
        <tr>
            <td>#${user.id}</td>
            <td>${user.first_name} ${user.last_name}</td>
            <td>${user.email}</td>
            <td>${user.phone || 'N/A'}</td>
            <td>
                <span class="user-type ${user.user_type}">
                    ${getUserTypeLabel(user)}
                </span>
            </td>
            <td>
                <span class="status ${user.is_active ? 'active' : 'inactive'}">
                    ${user.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>${formatDate(user.date_joined)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon edit" onclick="editUser(${user.id})" title="Edit User">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteUser(${user.id})" title="Delete User">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-icon toggle" onclick="toggleUserStatus(${user.id})" title="${user.is_active ? 'Deactivate' : 'Activate'} User">
                        <i class="fas fa-${user.is_active ? 'user-times' : 'user-check'}"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Get user type label
function getUserTypeLabel(user) {
    if (user.is_superuser) return 'Super Admin';
    if (user.is_staff) return 'Admin';
    if (user.user_type === 'salon_owner') return 'Salon Owner';
    return 'Customer';
}

// Filter users
function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const typeFilter = document.getElementById('userTypeFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    filteredUsers = allUsers.filter(user => {
        const matchesSearch = 
            user.first_name.toLowerCase().includes(searchTerm) ||
            user.last_name.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm) ||
            (user.phone && user.phone.includes(searchTerm));
        
        const matchesType = !typeFilter || 
            (typeFilter === 'admin' && (user.is_staff || user.is_superuser)) ||
            (typeFilter !== 'admin' && user.user_type === typeFilter);
        
        const matchesStatus = !statusFilter ||
            (statusFilter === 'active' && user.is_active) ||
            (statusFilter === 'inactive' && !user.is_active);
        
        return matchesSearch && matchesType && matchesStatus;
    });
    
    currentPage = 1;
    displayUsers();
    createPagination();
}

// Create pagination
function createPagination() {
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    const pagination = document.getElementById('usersPagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '<div class="pagination-controls">';
    
    // Previous button
    paginationHTML += `
        <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" 
                onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            paginationHTML += `
                <button class="pagination-btn ${i === currentPage ? 'active' : ''}" 
                        onclick="changePage(${i})">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationHTML += '<span class="pagination-dots">...</span>';
        }
    }
    
    // Next button
    paginationHTML += `
        <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    paginationHTML += '</div>';
    pagination.innerHTML = paginationHTML;
}

// Change page
function changePage(page) {
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        displayUsers();
        createPagination();
    }
}

// Show add user modal
function showAddUserModal() {
    const modal = document.getElementById('addUserModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
        
        // Reset form if it exists
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    }
}

// Edit user
function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editFirstName').value = user.first_name;
    document.getElementById('editLastName').value = user.last_name;
    document.getElementById('editEmail').value = user.email;
    document.getElementById('editPhone').value = user.phone || '';
    document.getElementById('editIsActive').checked = user.is_active;
    
    // Set user type radio button
    const userType = user.is_superuser || user.is_staff ? 'admin' : user.user_type;
    document.querySelector(`input[name="editUserType"][value="${userType}"]`).checked = true;
    
    const modal = document.getElementById('editUserModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Delete user
async function deleteUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        showNotification('User not found', 'error');
        return;
    }
    
    // Prevent deleting the current admin user
    const currentUser = JSON.parse(localStorage.getItem('user_data') || '{}');
    if (user.id === currentUser.id) {
        showNotification('Cannot delete your own account', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete user "${user.first_name} ${user.last_name}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const token = localStorage.getItem('access_token');
        
        // Try API call first
        const response = await fetch(`http://localhost:8000/api/accounts/users/${userId}/`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            showNotification('User deleted successfully', 'success');
            loadAllUsers(); // Reload users
        } else {
            throw new Error('API delete not implemented');
        }
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Error deleting user: ' + error.message, 'error');
    }
}

// Toggle user status
async function toggleUserStatus(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        showNotification('User not found', 'error');
        return;
    }
    
    const action = user.is_active ? 'deactivate' : 'activate';
    
    // Prevent deactivating the current admin user
    const currentUser = JSON.parse(localStorage.getItem('user_data') || '{}');
    if (user.id === currentUser.id && action === 'deactivate') {
        showNotification('Cannot deactivate your own account', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to ${action} user "${user.first_name} ${user.last_name}"?`)) {
        return;
    }
    
    try {
        const token = localStorage.getItem('access_token');
        
        const response = await fetch(`http://localhost:8000/api/accounts/users/${userId}/toggle-status/`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            showNotification(`User ${action}d successfully`, 'success');
            loadAllUsers(); // Reload users
        } else {
            throw new Error(`Failed to ${action} user`);
        }
        
    } catch (error) {
        console.error(`Error ${action}ing user:`, error);
        showNotification(`Error ${action}ing user: ` + error.message, 'error');
    }
}

// Refresh users
function refreshUsers() {
    showNotification('Refreshing users...', 'info');
    loadAllUsers();
}

// Export users
function exportUsers() {
    try {
        const csvContent = "data:text/csv;charset=utf-8," 
            + "ID,First Name,Last Name,Email,Phone,User Type,Status,Date Joined\n"
            + filteredUsers.map(user => 
                `${user.id},"${user.first_name}","${user.last_name}","${user.email}","${user.phone || ''}","${getUserTypeLabel(user)}","${user.is_active ? 'Active' : 'Inactive'}","${formatDate(user.date_joined)}"`
            ).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `salon_users_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Users exported successfully', 'success');
    } catch (error) {
        showNotification('Error exporting users', 'error');
    }
}

// Add user form handler
document.getElementById('addUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = {
        firstName: document.getElementById('addFirstName').value,
        lastName: document.getElementById('addLastName').value,
        email: document.getElementById('addEmail').value,
        phone: document.getElementById('addPhone').value,
        password: document.getElementById('addPassword').value,
        userType: document.querySelector('input[name="addUserType"]:checked').value
    };
    
    // Basic validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    if (formData.password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        return;
    }
    
    // Check if email already exists
    if (allUsers.some(user => user.email === formData.email)) {
        showNotification('User with this email already exists', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('access_token');
        
        const response = await fetch('http://localhost:8000/api/accounts/register/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            showNotification('User created successfully', 'success');
            closeModal('addUserModal');
            loadAllUsers(); // Reload users
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create user');
        }
        
    } catch (error) {
        console.error('Error creating user:', error);
        showNotification('Error creating user: ' + error.message, 'error');
    }
});

// Edit user form handler  
document.getElementById('editUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const formData = {
        firstName: document.getElementById('editFirstName').value,
        lastName: document.getElementById('editLastName').value,
        email: document.getElementById('editEmail').value,
        phone: document.getElementById('editPhone').value,
        userType: document.querySelector('input[name="editUserType"]:checked').value,
        isActive: document.getElementById('editIsActive').checked
    };
    
    try {
        showNotification('Updating user...', 'info');
        
        // For now, just update locally since we haven't implemented the update API
        const userIndex = allUsers.findIndex(u => u.id == userId);
        if (userIndex !== -1) {
            allUsers[userIndex].first_name = formData.firstName;
            allUsers[userIndex].last_name = formData.lastName;
            allUsers[userIndex].email = formData.email;
            allUsers[userIndex].phone = formData.phone;
            allUsers[userIndex].user_type = formData.userType;
            allUsers[userIndex].is_active = formData.isActive;
        }
        
        showNotification('User updated successfully (demo)', 'success');
        closeModal('editUserModal');
        filterUsers(); // Refresh display
        
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification('Error updating user: ' + error.message, 'error');
    }
});

// Format date helper
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

// Notification system
function showNotification(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.admin-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `admin-notification admin-notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    notification.style.cssText = `
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
        min-width: 300px;
        background: ${type === 'error' ? '#e53e3e' : type === 'success' ? '#38a169' : '#4299e1'};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
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

// Close modals when clicking outside
window.onclick = function(event) {
    const addModal = document.getElementById('addUserModal');
    const editModal = document.getElementById('editUserModal');
    
    if (event.target === addModal) {
        closeModal('addUserModal');
    }
    if (event.target === editModal) {
        closeModal('editUserModal');
    }
}
