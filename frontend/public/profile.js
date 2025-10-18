// Profile Management JavaScript

// Check if user is logged in
const userData = JSON.parse(localStorage.getItem('user_data'));
const accessToken = localStorage.getItem('access_token');

if (!userData || !accessToken) {
    window.location.href = '/';
}

// Load user profile on page load
window.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
    loadUserStats();
});

// Load user profile data
function loadUserProfile() {
    // Populate form fields with user data
    document.getElementById('firstName').value = userData.first_name || '';
    document.getElementById('lastName').value = userData.last_name || '';
    document.getElementById('email').value = userData.email || '';
    document.getElementById('phone').value = userData.phone || '';
    document.getElementById('address').value = userData.address || '';

    // Set avatar - check if user has uploaded photo first
    const avatarCircle = document.getElementById('avatarCircle');
    const profilePicture = userData.profile_picture || userData.avatar; // Support both field names
    
    if (profilePicture) {
        // User has uploaded avatar
        const avatarUrl = profilePicture.startsWith('http') 
            ? profilePicture 
            : `http://localhost:8000${profilePicture}`;
        avatarCircle.innerHTML = `<img src="${avatarUrl}" alt="Profile Picture" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else {
        // Show initials as fallback
        const initials = `${userData.first_name?.charAt(0) || ''}${userData.last_name?.charAt(0) || ''}`.toUpperCase();
        if (initials) {
            avatarCircle.innerHTML = `<span class="avatar-initials">${initials}</span>`;
        }
    }

    // Set member since date
    const memberDate = new Date(userData.date_joined || Date.now());
    const monthYear = memberDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    document.getElementById('memberSince').textContent = monthYear;
    
    // Highlight incomplete fields
    highlightIncompleteFields();
}

// Highlight incomplete profile fields
function highlightIncompleteFields() {
    const fields = [
        { id: 'firstName', value: userData.first_name, label: 'First Name' },
        { id: 'lastName', value: userData.last_name, label: 'Last Name' },
        { id: 'phone', value: userData.phone, label: 'Phone Number' },
        { id: 'address', value: userData.address, label: 'Address' }
    ];
    
    fields.forEach(field => {
        const input = document.getElementById(field.id);
        const formGroup = input?.closest('.form-group');
        
        if (!field.value && formGroup) {
            // Add warning indicator
            const label = formGroup.querySelector('label');
            if (label && !label.querySelector('.required-badge')) {
                const badge = document.createElement('span');
                badge.className = 'required-badge';
                badge.innerHTML = '<i class="fas fa-exclamation-circle"></i> Required';
                label.appendChild(badge);
            }
            
            // Add warning border to input
            if (input) {
                input.classList.add('field-incomplete');
            }
        }
    });
}

// Load user statistics
async function loadUserStats() {
    try {
        const response = await authenticatedFetch('http://localhost:8000/api/bookings/my-bookings/');
        if (response.ok) {
            const bookings = await response.json();
            document.getElementById('totalBookings').textContent = bookings.length || 0;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Authenticated fetch with token refresh
async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('access_token');
    
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    let response = await fetch(url, defaultOptions);

    // If token expired, try to refresh
    if (response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            // Retry with new token
            defaultOptions.headers['Authorization'] = `Bearer ${localStorage.getItem('access_token')}`;
            response = await fetch(url, defaultOptions);
        } else {
            // Refresh failed, redirect to login
            logout();
        }
    }

    return response;
}

// Refresh access token
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    try {
        const response = await fetch('http://localhost:8000/api/accounts/token/refresh/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refreshToken })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('access_token', data.access);
            return true;
        }
    } catch (error) {
        console.error('Token refresh failed:', error);
    }
    return false;
}

// Toggle edit mode for a section
function toggleEditMode(section) {
    if (section === 'personal') {
        const form = document.getElementById('personalInfoForm');
        const inputs = form.querySelectorAll('input:not([type="email"])');
        const textarea = form.querySelector('textarea');
        const actions = document.getElementById('personalActions');
        const editBtn = document.getElementById('editPersonalBtn');
        
        const isDisabled = inputs[0].disabled;
        
        inputs.forEach(input => {
            input.disabled = !isDisabled;
        });
        
        if (textarea) {
            textarea.disabled = !isDisabled;
        }
        
        actions.style.display = isDisabled ? 'flex' : 'none';
        editBtn.style.display = isDisabled ? 'none' : 'flex';
    } else if (section === 'password') {
        document.getElementById('passwordForm').style.display = 'block';
        document.getElementById('passwordInfo').style.display = 'none';
        document.getElementById('editPasswordBtn').style.display = 'none';
    }
}

// Cancel edit mode
function cancelEdit(section) {
    if (section === 'personal') {
        const form = document.getElementById('personalInfoForm');
        const inputs = form.querySelectorAll('input');
        const actions = document.getElementById('personalActions');
        const editBtn = document.getElementById('editPersonalBtn');

        // Reset to original values
        loadUserProfile();
        inputs.forEach(input => input.disabled = true);
        actions.style.display = 'none';
        editBtn.style.display = 'block';
    } else if (section === 'password') {
        document.getElementById('passwordForm').style.display = 'none';
        document.getElementById('passwordInfo').style.display = 'flex';
        document.getElementById('editPasswordBtn').style.display = 'block';
        document.getElementById('passwordForm').reset();
    }
}

// Handle personal info form submission
document.getElementById('personalInfoForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = {
        first_name: document.getElementById('firstName').value,
        last_name: document.getElementById('lastName').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value
    };

    try {
        showNotification('Updating profile...', 'info');

        const response = await authenticatedFetch('http://localhost:8000/api/accounts/profile/update/', {
            method: 'PATCH',
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            // Update local storage
            const updatedUser = { ...userData, ...data.user };
            localStorage.setItem('user_data', JSON.stringify(updatedUser));
            
            showNotification('Profile updated successfully!', 'success');
            cancelEdit('personal');
            loadUserProfile();
        } else {
            showNotification(data.error || 'Failed to update profile', 'error');
        }
    } catch (error) {
        console.error('Update error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
});

// Handle password form submission
document.getElementById('passwordForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validation
    if (newPassword !== confirmPassword) {
        showNotification('New passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 8) {
        showNotification('Password must be at least 8 characters', 'error');
        return;
    }

    try {
        showNotification('Updating password...', 'info');

        const response = await authenticatedFetch('http://localhost:8000/api/accounts/change-password/', {
            method: 'POST',
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Password updated successfully!', 'success');
            cancelEdit('password');
        } else {
            showNotification(data.error || 'Failed to update password', 'error');
        }
    } catch (error) {
        console.error('Password update error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
});

// Change avatar
function changeAvatar() {
    document.getElementById('avatarInput').click();
}

// Handle avatar change
function handleAvatarChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showNotification('Please select an image file', 'error');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Image size must be less than 5MB', 'error');
        return;
    }

    // Preview image
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('avatarCircle').innerHTML = `<img src="${e.target.result}" alt="Avatar">`;
    };
    reader.readAsDataURL(file);

    // Upload avatar
    uploadAvatar(file);
}

// Upload avatar to server
async function uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);

    try {
        showNotification('Uploading photo...', 'info');

        const token = localStorage.getItem('access_token');
        const response = await fetch('http://localhost:8000/api/accounts/profile/avatar/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            // Update localStorage with new user data
            if (data.user) {
                const currentUser = JSON.parse(localStorage.getItem('user_data'));
                const updatedUser = { ...currentUser, ...data.user };
                localStorage.setItem('user_data', JSON.stringify(updatedUser));
            }
            showNotification('Profile photo updated!', 'success');
        } else {
            showNotification(data.error || 'Failed to upload photo', 'error');
            // Revert to initials
            loadUserProfile();
        }
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Network error. Please try again.', 'error');
        loadUserProfile();
    }
}

// Update preference
async function updatePreference(preference) {
    const value = document.getElementById(preference).checked;
    
    try {
        const response = await authenticatedFetch('http://localhost:8000/api/accounts/profile/preferences/', {
            method: 'PATCH',
            body: JSON.stringify({
                [preference]: value
            })
        });

        if (response.ok) {
            showNotification('Preference updated', 'success');
        } else {
            showNotification('Failed to update preference', 'error');
            // Revert checkbox
            document.getElementById(preference).checked = !value;
        }
    } catch (error) {
        console.error('Preference update error:', error);
        document.getElementById(preference).checked = !value;
    }
}

// Confirm delete account
function confirmDeleteAccount() {
    document.getElementById('deleteModal').style.display = 'flex';
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    document.getElementById('deleteConfirmation').value = '';
}

// Delete account
async function deleteAccount() {
    const confirmation = document.getElementById('deleteConfirmation').value;

    if (confirmation !== 'DELETE') {
        showNotification('Please type "DELETE" to confirm', 'error');
        return;
    }

    try {
        showNotification('Deleting account...', 'info');

        const response = await authenticatedFetch('http://localhost:8000/api/accounts/profile/delete/', {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('Account deleted successfully', 'success');
            setTimeout(() => {
                localStorage.clear();
                window.location.href = '/';
            }, 2000);
        } else {
            const data = await response.json();
            showNotification(data.error || 'Failed to delete account', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Note: logout() and toggleUserMenu() are now in /components/navbar.js

// Notification system
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('deleteModal');
    if (event.target === modal) {
        closeDeleteModal();
    }
}
