// Google OAuth Client ID
const GOOGLE_CLIENT_ID = '283246214071-eqctr8egt9snucarjlsig6o2rbg9aqe2.apps.googleusercontent.com';

// Initialize Google Sign-In on page load
window.onload = function() {
    initializeGoogleSignIn();
};

function initializeGoogleSignIn() {
    // Skip if using placeholder Client ID
    if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
        console.log('Google OAuth not configured yet. Please follow GOOGLE_OAUTH_SETUP.md');
        return;
    }
    
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSignIn
        });
        
        google.accounts.id.renderButton(
            document.getElementById('googleSignInButton'),
            {
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                width: 350
            }
        );
    }
}

// Handle Google Sign-In response
async function handleGoogleSignIn(response) {
    try {
        const credential = response.credential;
        
        // Send to backend
        const res = await fetch(`${window.API_BASE_URL}/api/accounts/google-login/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: credential
            })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            // Save tokens and user data
            localStorage.setItem('access_token', data.tokens.access);
            localStorage.setItem('refresh_token', data.tokens.refresh);
            localStorage.setItem('user_data', JSON.stringify(data.user));
            
            showNotification('Login successful! Redirecting...', 'success');
            
            // Redirect based on user type
            setTimeout(() => {
                if (data.user.user_type === 'salon_owner') {
                    window.location.href = '/salon/dashboard';
                } else if (data.user.user_type === 'admin') {
                    window.location.href = '/admin/dashboard';
                } else {
                    window.location.href = '/home';
                }
            }, 1000);
        } else {
            showNotification(data.error || 'Google login failed', 'error');
        }
    } catch (error) {
        console.error('Google login error:', error);
        showNotification('Failed to login with Google', 'error');
    }
}

// Modal functionality
function showLogin() {
    document.getElementById('loginModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
    // Re-render Google button when modal opens
    setTimeout(initializeGoogleSignIn, 100);
}

function showRegister() {
    document.getElementById('registerModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = 'auto';
}

function switchToRegister() {
    closeModal('loginModal');
    showRegister();
}

function switchToLogin() {
    closeModal('registerModal');
    showLogin();
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const verificationModal = document.getElementById('verificationModal');
    
    if (event.target === loginModal) {
        closeModal('loginModal');
    }
    if (event.target === registerModal) {
        closeModal('registerModal');
    }
    if (event.target === verificationModal) {
        // Don't close verification modal by clicking outside
        // closeModal('verificationModal');
    }
}

// Form validation and submission
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const loginInput = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!loginInput || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    try {
        showNotification('Logging in...', 'info');
        
        const response = await fetch(`${window.API_BASE_URL}/api/accounts/login/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: loginInput,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Login successful! Welcome back!', 'success');
            // Store tokens if needed
            localStorage.setItem('access_token', data.tokens.access);
            localStorage.setItem('refresh_token', data.tokens.refresh);
            localStorage.setItem('user_data', JSON.stringify(data.user));
            
            setTimeout(() => {
                closeModal('loginModal');
                // Redirect admin users to admin dashboard
                if (data.user.is_staff || data.user.is_superuser) {
                    window.location.href = '/admin';
                } else {
                    // Regular users go to customer home page
                    window.location.href = '/home';
                }
            }, 1500);
        } else {
            // Check if email is not verified
            if (data.email_not_verified) {
                showNotification('Please verify your email first', 'error');
                closeModal('loginModal');
                sessionStorage.setItem('verificationEmail', loginInput);
                setTimeout(() => showVerification(loginInput), 500);
            } else {
                showNotification(data.error || 'Login failed', 'error');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
});

document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const userTypeElement = document.querySelector('input[name="userType"]:checked') || document.querySelector('input[name="userType"]');
    const userType = userTypeElement ? userTypeElement.value : 'customer';
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    // Validation
    if (!firstName || !lastName || !email || !phone || !password || !confirmPassword) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        return;
    }
    
    if (!agreeTerms) {
        showNotification('Please agree to the Terms & Conditions', 'error');
        return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    // Phone validation (basic)
    const phoneRegex = /^[+]?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone)) {
        showNotification('Please enter a valid phone number', 'error');
        return;
    }
    
    try {
        showNotification('Creating account...', 'info');
        
        const response = await fetch(`${window.API_BASE_URL}/api/accounts/register/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                firstName: firstName,
                lastName: lastName,
                email: email,
                phone: phone,
                password: password,
                userType: userType
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Account created successfully! Check your email.', 'success');
            // Store email for verification
            sessionStorage.setItem('verificationEmail', email);
            setTimeout(() => {
                closeModal('registerModal');
                showVerification(email);
            }, 1500);
        } else {
            showNotification(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
});

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = 'notification notification-' + type;
    notification.innerHTML = '<span>' + message + '</span><button onclick="this.parentElement.remove()">&times;</button>';
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Notification styles are defined in styles.css

// Smooth scrolling for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Add loading animation for buttons
function addLoadingState(button) {
    const originalText = button.textContent;
    button.textContent = 'Loading...';
    button.disabled = true;
    
    setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
    }, 2000);
}

// Password strength indicator
document.getElementById('registerPassword').addEventListener('input', function() {
    const password = this.value;
    const strengthIndicator = document.getElementById('passwordStrength') || createPasswordStrengthIndicator();
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    
    const strengthLevels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const strengthColors = ['#dc3545', '#fd7e14', '#ffc107', '#28a745', '#20c997'];
    
    strengthIndicator.textContent = `Password Strength: ${strengthLevels[strength] || 'Very Weak'}`;
    strengthIndicator.style.color = strengthColors[strength] || '#dc3545';
});

function createPasswordStrengthIndicator() {
    const indicator = document.createElement('small');
    indicator.id = 'passwordStrength';
    indicator.style.display = 'block';
    indicator.style.marginTop = '0.5rem';
    document.getElementById('registerPassword').parentNode.appendChild(indicator);
    return indicator;
}

// Email Verification Functions
let countdownInterval;

function showVerification(email) {
    document.getElementById('verificationEmail').textContent = email;
    document.getElementById('verificationModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Clear all code inputs
    document.querySelectorAll('.code-digit').forEach(input => {
        input.value = '';
    });
    
    // Focus first input
    document.querySelector('.code-digit').focus();
    
    // Start countdown timer
    startCountdown(15 * 60); // 15 minutes in seconds
}

function startCountdown(seconds) {
    clearInterval(countdownInterval);
    let timeLeft = seconds;
    
    const countdownElement = document.getElementById('countdown');
    
    countdownInterval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        countdownElement.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            countdownElement.textContent = 'Expired';
            countdownElement.style.color = '#dc3545';
            showNotification('Verification code expired. Please request a new one.', 'error');
        }
        
        timeLeft--;
    }, 1000);
}

// Auto-tab functionality for code inputs
document.querySelectorAll('.code-digit').forEach((input, index, inputs) => {
    input.addEventListener('input', function(e) {
        if (this.value.length === 1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    });
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && !this.value && index > 0) {
            inputs[index - 1].focus();
        }
    });
    
    // Only allow numbers
    input.addEventListener('input', function(e) {
        this.value = this.value.replace(/[^0-9]/g, '');
    });
});

// Email verification form submission
document.getElementById('verificationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const codeDigits = document.querySelectorAll('.code-digit');
    const code = Array.from(codeDigits).map(input => input.value).join('');
    const email = sessionStorage.getItem('verificationEmail');
    
    if (code.length !== 6) {
        showNotification('Please enter all 6 digits', 'error');
        return;
    }
    
    try {
        showNotification('Verifying...', 'info');
        
        const response = await fetch(`${window.API_BASE_URL}/api/accounts/verify-email/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                code: code
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Email verified successfully! Redirecting to home...', 'success');
            clearInterval(countdownInterval);
            
            // Store user data if returned by backend
            if (data.tokens) {
                localStorage.setItem('access_token', data.tokens.access);
                localStorage.setItem('refresh_token', data.tokens.refresh);
                localStorage.setItem('user_data', JSON.stringify(data.user));
            }
            
            sessionStorage.removeItem('verificationEmail');
            
            setTimeout(() => {
                closeModal('verificationModal');
                // Redirect based on user type or to home page
                if (data.user && data.user.user_type === 'salon_owner') {
                    window.location.href = '/salon/dashboard';
                } else if (data.user && data.user.is_staff) {
                    window.location.href = '/admin/dashboard';
                } else {
                    window.location.href = '/home';
                }
            }, 1500);
        } else {
            showNotification(data.error || 'Verification failed', 'error');
            // Clear inputs on error
            codeDigits.forEach(input => input.value = '');
            codeDigits[0].focus();
        }
    } catch (error) {
        console.error('Verification error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
});

// Resend verification code
async function resendVerificationCode() {
    const email = sessionStorage.getItem('verificationEmail');
    const resendBtn = document.getElementById('resendBtn');
    
    if (!email) {
        showNotification('Email not found. Please register again.', 'error');
        return;
    }
    
    try {
        resendBtn.disabled = true;
        showNotification('Sending new code...', 'info');
        
        const response = await fetch(`${window.API_BASE_URL}/api/accounts/resend-verification/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('New verification code sent! Check your email.', 'success');
            // Clear inputs
            document.querySelectorAll('.code-digit').forEach(input => input.value = '');
            document.querySelector('.code-digit').focus();
            // Restart countdown
            startCountdown(15 * 60);
            
            // Re-enable button after 60 seconds
            setTimeout(() => {
                resendBtn.disabled = false;
            }, 60000);
        } else {
            showNotification(data.error || 'Failed to resend code', 'error');
            resendBtn.disabled = false;
        }
    } catch (error) {
        console.error('Resend error:', error);
        showNotification('Network error. Please try again.', 'error');
        resendBtn.disabled = false;
    }
}

// ==================== FORGOT PASSWORD FUNCTIONALITY ====================

// Show forgot password modal
function showForgotPassword() {
    closeModal('loginModal');
    document.getElementById('forgotPasswordModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
    document.getElementById('resetEmail').value = '';
}

// Forgot Password - Step 1: Request Reset Code
document.getElementById('forgotPasswordForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('resetEmail').value;
    
    if (!email) {
        showNotification('Please enter your email address', 'error');
        return;
    }
    
    try {
        showNotification('Sending reset code...', 'info');
        
        const response = await fetch(`${window.API_BASE_URL}/api/accounts/request-password-reset/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Reset code sent! Check your email.', 'success');
            sessionStorage.setItem('resetEmail', email);
            closeModal('forgotPasswordModal');
            setTimeout(() => showResetCodeModal(email), 500);
        } else {
            showNotification(data.error || 'Failed to send reset code', 'error');
        }
    } catch (error) {
        console.error('Reset request error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
});

// Show reset code modal
function showResetCodeModal(email) {
    document.getElementById('resetEmailDisplay').textContent = email;
    document.getElementById('resetCodeModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Clear previous code inputs
    document.querySelectorAll('.reset-code-digit').forEach(input => {
        input.value = '';
    });
    document.querySelector('.reset-code-digit').focus();
    
    // Start countdown
    startResetCountdown(15 * 60);
}

// Reset code countdown timer
let resetCountdownInterval;

function startResetCountdown(seconds) {
    clearInterval(resetCountdownInterval);
    let timeLeft = seconds;
    
    resetCountdownInterval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        
        const countdownElement = document.getElementById('resetCountdown');
        if (countdownElement) {
            countdownElement.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
        
        if (timeLeft <= 0) {
            clearInterval(resetCountdownInterval);
            if (countdownElement) {
                countdownElement.textContent = 'Expired';
                countdownElement.style.color = '#dc3545';
            }
        }
        
        timeLeft--;
    }, 1000);
}

// Auto-tab functionality for reset code inputs
document.querySelectorAll('.reset-code-digit').forEach((input, index, inputs) => {
    input.addEventListener('input', function(e) {
        if (this.value.length === 1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    });
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && !this.value && index > 0) {
            inputs[index - 1].focus();
        }
    });
    
    // Only allow numbers
    input.addEventListener('input', function(e) {
        this.value = this.value.replace(/[^0-9]/g, '');
    });
});

// Reset Code - Step 2: Verify Code
document.getElementById('resetCodeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const codeDigits = document.querySelectorAll('.reset-code-digit');
    const code = Array.from(codeDigits).map(input => input.value).join('');
    const email = sessionStorage.getItem('resetEmail');
    
    if (code.length !== 6) {
        showNotification('Please enter the complete 6-digit code', 'error');
        return;
    }
    
    try {
        showNotification('Verifying code...', 'info');
        
        const response = await fetch(`${window.API_BASE_URL}/api/accounts/verify-reset-code/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                code: code
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Code verified!', 'success');
            sessionStorage.setItem('resetCode', code);
            closeModal('resetCodeModal');
            setTimeout(() => showNewPasswordModal(), 500);
        } else {
            showNotification(data.error || 'Invalid code', 'error');
            // Clear inputs
            document.querySelectorAll('.reset-code-digit').forEach(input => input.value = '');
            document.querySelector('.reset-code-digit').focus();
        }
    } catch (error) {
        console.error('Verification error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
});

// Show new password modal
function showNewPasswordModal() {
    document.getElementById('newPasswordModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
}

// New Password - Step 3: Set New Password
document.getElementById('newPasswordForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    const email = sessionStorage.getItem('resetEmail');
    const code = sessionStorage.getItem('resetCode');
    
    if (newPassword !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 8) {
        showNotification('Password must be at least 8 characters long', 'error');
        return;
    }
    
    try {
        showNotification('Resetting password...', 'info');
        
        const response = await fetch(`${window.API_BASE_URL}/api/accounts/reset-password/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                code: code,
                newPassword: newPassword
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Password reset successfully! You can now login.', 'success');
            // Clear session storage
            sessionStorage.removeItem('resetEmail');
            sessionStorage.removeItem('resetCode');
            clearInterval(resetCountdownInterval);
            
            closeModal('newPasswordModal');
            setTimeout(() => showLogin(), 1500);
        } else {
            showNotification(data.error || 'Failed to reset password', 'error');
        }
    } catch (error) {
        console.error('Reset password error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
});

// Resend reset code
async function resendResetCode() {
    const email = sessionStorage.getItem('resetEmail');
    
    if (!email) {
        showNotification('Session expired. Please try again.', 'error');
        return;
    }
    
    try {
        showNotification('Sending new code...', 'info');
        
        const response = await fetch(`${window.API_BASE_URL}/api/accounts/request-password-reset/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('New code sent! Check your email.', 'success');
            // Clear inputs
            document.querySelectorAll('.reset-code-digit').forEach(input => input.value = '');
            document.querySelector('.reset-code-digit').focus();
            // Restart countdown
            startResetCountdown(15 * 60);
        } else {
            showNotification(data.error || 'Failed to resend code', 'error');
        }
    } catch (error) {
        console.error('Resend error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Close forgot password modals when clicking outside
window.addEventListener('click', function(event) {
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const resetCodeModal = document.getElementById('resetCodeModal');
    const newPasswordModal = document.getElementById('newPasswordModal');
    
    if (event.target === forgotPasswordModal) {
        closeModal('forgotPasswordModal');
    } else if (event.target === resetCodeModal) {
        closeModal('resetCodeModal');
    } else if (event.target === newPasswordModal) {
        closeModal('newPasswordModal');
    }
});
