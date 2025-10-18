let allBookings = [];
let currentFilter = 'all';

// Load data on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadUserData();
    loadMyBookings();
    
    // Handle Stripe payment return
    handleStripePaymentReturn();
});

// Open review modal (wrapper function that calls reviews.js function)
function openReviewModal(salonId, salonName, bookingId) {
    // This function is defined in reviews.js
    if (typeof showReviewModal === 'function') {
        showReviewModal(salonId, salonName, bookingId);
    } else {
        console.error('showReviewModal function not found. Make sure reviews.js is loaded.');
    }
}

function checkAuth() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    
    if (!userData) {
        window.location.href = '/';
        return;
    }
}

function loadUserData() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    
    if (userData) {
        const firstName = userData.first_name || 'User';
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = firstName;
        
        // Check if user is a salon owner and update button
        if (userData.user_type === 'salon_owner') {
            const btn = document.getElementById('salonActionBtn');
            const btnText = document.getElementById('salonBtnText');
            const btnIcon = btn ? btn.querySelector('i') : null;
            
            if (btnText) btnText.textContent = 'Manage My Salon';
            if (btnIcon) btnIcon.className = 'fas fa-cog';
            if (btn) {
                btn.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
                btn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
            }
        }
    }
}

// Load user's bookings
async function loadMyBookings() {
    try {
        const accessToken = localStorage.getItem('access_token');
        
        const response = await fetch('http://localhost:8000/api/bookings/my-bookings/', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            allBookings = await response.json();
            console.log('Bookings loaded:', allBookings);
            displayBookings(allBookings);
        } else {
            console.error('Failed to load bookings');
            showEmptyState();
        }
        
    } catch (error) {
        console.error('Error loading bookings:', error);
        showEmptyState();
    }
}

// Display bookings
function displayBookings(bookings) {
    const container = document.getElementById('bookingsContainer');
    
    // Filter bookings based on current filter
    let filteredBookings = bookings;
    if (currentFilter !== 'all') {
        filteredBookings = bookings.filter(b => b.status === currentFilter);
    }
    
    if (filteredBookings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <h3>No bookings found</h3>
                <p>You haven't made any bookings yet. Start booking your favorite salons!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredBookings.map(booking => {
        const needsPayment = booking.status === 'confirmed' && booking.payment_status === 'pending';
        const paymentStatusBadge = getPaymentStatusBadge(booking.payment_status);
        const isCompleted = booking.status === 'completed';
        const isPending = booking.status === 'pending';
        const hasReview = booking.has_review || false;
        
        // Get service image or use placeholder
        const serviceImage = booking.service.images && booking.service.images.length > 0
            ? booking.service.images[0]
            : 'https://via.placeholder.com/200x150?text=' + encodeURIComponent(booking.service.name);
        
        return `
        <div class="booking-card-new" data-status="${booking.status}">
            <!-- Service Image -->
            <div class="booking-image">
                <img src="${serviceImage}" alt="${booking.service.name}" onerror="this.src='https://via.placeholder.com/200x150?text=Service'">
            </div>
            
            <!-- Booking Content -->
            <div class="booking-content">
                <!-- Header -->
                <div class="booking-header">
                    <div>
                        <h3 class="salon-name">${booking.salon.name}</h3>
                        <p class="booking-ref">Booking #${booking.id}</p>
                    </div>
                    <div class="status-badges">
                        <span class="status-badge status-${booking.status}">${booking.status.toUpperCase()}</span>
                        ${paymentStatusBadge}
                    </div>
                </div>
                
                <!-- Service Name -->
                <div class="service-title">
                    <i class="fas fa-scissors"></i>
                    <span>${booking.service.name}</span>
                </div>
                
                <!-- Details Grid -->
                <div class="booking-info-grid">
                    <div class="info-item">
                        <i class="fas fa-calendar"></i>
                        <span>${formatDate(booking.booking_date)}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-clock"></i>
                        <span>${formatTime(booking.booking_time)}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-hourglass-half"></i>
                        <span>${booking.duration} min</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-peso-sign"></i>
                        <span>₱${booking.price}</span>
                    </div>
                </div>
                
                ${hasReview && booking.review_rating ? `
                    <div class="review-badge">
                        <div class="stars-small">
                            ${'★'.repeat(booking.review_rating)}${'☆'.repeat(5 - booking.review_rating)}
                        </div>
                        <span>Your Rating</span>
                    </div>
                ` : ''}
                
                <!-- Actions -->
                <div class="booking-actions">
                    ${isPending ? `
                        <button class="btn-cancel-booking" onclick="cancelBooking(${booking.id})">
                            <i class="fas fa-times-circle"></i> Cancel
                        </button>
                    ` : ''}
                    ${booking.status === 'confirmed' ? `
                        <button class="btn-calendar" onclick="addToGoogleCalendar(${booking.id})">
                            <i class="fab fa-google"></i> Add to Calendar
                        </button>
                    ` : ''}
                    ${needsPayment ? `
                        <button class="btn-pay-now" onclick="openPaymentModal(${booking.id})">
                            <i class="fas fa-credit-card"></i> Pay Now
                        </button>
                    ` : ''}
                    ${booking.payment_status === 'completed' ? `
                        <button class="btn-secondary" onclick="viewInvoice(${booking.id})">
                            <i class="fas fa-file-invoice"></i> Invoice
                        </button>
                    ` : ''}
                    ${isCompleted && !hasReview ? `
                        <button class="btn-primary" onclick="openReviewModal(${booking.salon.id}, '${booking.salon.name}', ${booking.id})">
                            <i class="fas fa-star"></i> Review
                        </button>
                    ` : ''}
                    <button class="btn-secondary" onclick="viewBookingDetails(${booking.id})">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

// Show empty state
function showEmptyState() {
    const container = document.getElementById('bookingsContainer');
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-calendar-times"></i>
            <h3>No bookings yet</h3>
            <p>Start exploring salons and book your first appointment!</p>
            <br>
            <a href="/home" style="display: inline-block; padding: 1rem 2rem; background: linear-gradient(45deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">
                <i class="fas fa-search"></i> Browse Salons
            </a>
        </div>
    `;
}

// Filter bookings
function filterBookings(status) {
    currentFilter = status;
    
    // Update active tab
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.filter-tab[data-status="${status}"]`).classList.add('active');
    
    // Display filtered bookings
    displayBookings(allBookings);
}

// Format date
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Format time
function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Get payment status badge
function getPaymentStatusBadge(paymentStatus) {
    const badges = {
        'pending': '<span class="status-badge status-payment-pending">PAYMENT PENDING</span>',
        'completed': '<span class="status-badge status-paid">PAID</span>',
        'refunded': '<span class="status-badge status-refunded">REFUNDED</span>',
        'failed': '<span class="status-badge status-failed">PAYMENT FAILED</span>'
    };
    return badges[paymentStatus] || '';
}

// Open payment modal
function openPaymentModal(bookingId) {
    const booking = allBookings.find(b => b.id === bookingId);
    
    if (!booking) return;
    
    // Store booking ID in modal dataset
    document.getElementById('paymentModal').dataset.bookingId = bookingId;
    
    // Display booking info
    document.getElementById('paymentBookingInfo').innerHTML = `
        <div class="payment-info-card">
            <h3>${booking.salon.name}</h3>
            <p><strong>Service:</strong> ${booking.service.name}</p>
            <p><strong>Date:</strong> ${formatDate(booking.booking_date)}</p>
            <p><strong>Time:</strong> ${formatTime(booking.booking_time)}</p>
            <p><strong>Duration:</strong> ${booking.duration} minutes</p>
            <div class="payment-total">
                <strong>Total Amount:</strong>
                <span class="amount">₱${booking.price}</span>
            </div>
        </div>
    `;
    
    // Show modal
    document.getElementById('paymentModal').style.display = 'flex';
    
    // Render PayPal button
    setTimeout(() => renderPayPalPaymentButton(booking), 200);
}

// Close payment modal
function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
    document.getElementById('paypal-button-container-payment').innerHTML = '';
}

// Render PayPal button for payment
function renderPayPalPaymentButton(booking) {
    const container = document.getElementById('paypal-button-container-payment');
    container.innerHTML = '';
    
    if (typeof paypal === 'undefined') {
        container.innerHTML = '<p style="text-align: center; color: #667eea;">Loading PayPal...</p>';
        setTimeout(() => renderPayPalPaymentButton(booking), 1000);
        return;
    }
    
    paypal.Buttons({
        createOrder: function(data, actions) {
            return actions.order.create({
                purchase_units: [{
                    amount: {
                        value: booking.price.toString()
                    },
                    description: `${booking.salon.name} - ${booking.service.name}`
                }]
            });
        },
        onApprove: async function(data, actions) {
            try {
                showNotification('Processing payment...', 'info');
                
                const order = await actions.order.capture();
                console.log('Payment successful:', order);
                
                // Update booking payment status
                const accessToken = localStorage.getItem('access_token');
                const response = await fetch(`http://localhost:8000/api/bookings/${booking.id}/update-payment-status/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        payment_status: 'completed',
                        paypal_order_id: order.id,
                        payment_id: data.orderID
                    })
                });
                
                if (response.ok) {
                    showNotification('Payment successful! Your booking is now fully confirmed.', 'success');
                    closePaymentModal();
                    // Reload bookings to reflect payment status
                    setTimeout(() => loadMyBookings(), 1500);
                } else {
                    showNotification('Payment received but status update failed. Please contact support.', 'warning');
                }
            } catch (error) {
                console.error('Payment error:', error);
                showNotification('Payment failed. Please try again.', 'error');
            }
        },
        onCancel: function(data) {
            showNotification('Payment cancelled', 'info');
        },
        onError: function(err) {
            console.error('PayPal error:', err);
            showNotification('Payment error. Please try again.', 'error');
        }
    }).render('#paypal-button-container-payment');
}

// View booking details
function viewBookingDetails(bookingId) {
    const booking = allBookings.find(b => b.id === bookingId);
    
    if (booking) {
        alert(`Booking Details\n\n` +
              `Salon: ${booking.salon.name}\n` +
              `Service: ${booking.service.name}\n` +
              `Date: ${formatDate(booking.booking_date)}\n` +
              `Time: ${formatTime(booking.booking_time)}\n` +
              `Duration: ${booking.duration} minutes\n` +
              `Price: ₱${booking.price}\n` +
              `Status: ${booking.status}\n` +
              `Payment: ${booking.payment_status}\n\n` +
              `Location: ${booking.salon.city}`);
    }
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
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
    window.location.href = '/';
}

// Show notification
function showNotification(message, type) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// ======================
// INVOICE FUNCTIONS
// ======================

function viewInvoice(bookingId) {
    const booking = allBookings.find(b => b.id === bookingId);
    if (!booking) {
        showNotification('Booking not found', 'error');
        return;
    }
    
    // Populate invoice modal
    document.getElementById('invoice-number').textContent = `INV-${String(booking.id).padStart(6, '0')}`;
    document.getElementById('invoice-date').textContent = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    // Customer info
    const userData = JSON.parse(localStorage.getItem('user_data'));
    document.getElementById('customer-name').textContent = userData.first_name + ' ' + userData.last_name;
    document.getElementById('customer-email').textContent = userData.email;
    document.getElementById('customer-phone').textContent = booking.customer_phone || 'N/A';
    
    // Salon info
    document.getElementById('salon-name').textContent = booking.salon.name;
    document.getElementById('salon-address').textContent = booking.salon.city || 'N/A';
    document.getElementById('salon-phone').textContent = booking.salon.phone || 'N/A';
    
    // Service items
    document.getElementById('invoice-items').innerHTML = `
        <tr>
            <td>${booking.service.name}</td>
            <td>${formatDate(booking.booking_date)} at ${formatTime(booking.booking_time)}</td>
            <td>${booking.duration} minutes</td>
            <td>₱${parseFloat(booking.price).toFixed(2)}</td>
        </tr>
    `;
    
    // Totals
    document.getElementById('invoice-subtotal').textContent = `₱${parseFloat(booking.price).toFixed(2)}`;
    document.getElementById('invoice-total').textContent = `₱${parseFloat(booking.price).toFixed(2)}`;
    
    // Payment info - Format payment method display
    let paymentMethodDisplay = 'PayPal';
    if (booking.payment_method) {
        const methodMap = {
            'paypal': 'PayPal',
            'stripe': 'Stripe / Credit Card',
            'pay_later': 'Pay Later at Salon',
            'cash': 'Cash',
            'card': 'Credit Card'
        };
        paymentMethodDisplay = methodMap[booking.payment_method] || booking.payment_method.replace('_', ' ').toUpperCase();
    }
    document.getElementById('payment-method').textContent = paymentMethodDisplay;
    
    const statusBadge = document.getElementById('payment-status-invoice');
    statusBadge.textContent = booking.payment_status.toUpperCase();
    statusBadge.className = `status-badge status-${booking.payment_status}`;
    
    document.getElementById('transaction-id').textContent = booking.payment_id || booking.paypal_order_id || 'N/A';
    document.getElementById('payment-date').textContent = formatDate(booking.created_at);
    
    // Show modal
    document.getElementById('invoice-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeInvoiceModal() {
    document.getElementById('invoice-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function printInvoice() {
    window.print();
}

function downloadInvoice() {
    // For now, just print - can add PDF generation later
    showNotification('Use Print button and select "Save as PDF"', 'info');
    window.print();
}

// ======================
// GOOGLE CALENDAR FUNCTIONS
// ======================

function addToCalendar(bookingId, calendarLink) {
    if (calendarLink) {
        // Open Google Calendar add event page
        window.open(calendarLink, '_blank');
        showNotification('Opening Google Calendar...', 'success');
    } else {
        // Fallback: fetch calendar link from API
        fetchCalendarLink(bookingId);
    }
}

async function fetchCalendarLink(bookingId) {
    try {
        const accessToken = localStorage.getItem('access_token');
        
        const response = await fetch(`http://localhost:8000/api/bookings/${bookingId}/calendar-link/`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            window.open(data.calendar_link, '_blank');
            showNotification('Opening Google Calendar...', 'success');
        } else {
            showNotification('Unable to generate calendar link', 'error');
        }
        
    } catch (error) {
        console.error('Error fetching calendar link:', error);
        showNotification('Error generating calendar link', 'error');
    }
}

// Cancel booking
async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
    }
    
    try {
        const accessToken = localStorage.getItem('access_token');
        
        showNotification('Cancelling booking...', 'info');
        
        const response = await fetch(`http://localhost:8000/api/bookings/${bookingId}/cancel/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                reason: 'Customer requested cancellation'
            })
        });
        
        if (response.ok) {
            showNotification('Booking cancelled successfully', 'success');
            // Reload bookings to reflect changes
            setTimeout(() => loadMyBookings(), 1000);
        } else {
            const data = await response.json();
            showNotification(data.error || 'Failed to cancel booking', 'error');
        }
        
    } catch (error) {
        console.error('Error cancelling booking:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Process Stripe payment
async function processStripePayment() {
    // Get current booking from modal
    const bookingId = document.getElementById('paymentModal').dataset.bookingId;
    const booking = allBookings.find(b => b.id == bookingId);
    
    if (!booking) {
        showNotification('Booking not found', 'error');
        return;
    }
    
    try {
        showNotification('Creating Stripe checkout session...', 'info');
        
        const accessToken = localStorage.getItem('access_token');
        
        // Create Stripe checkout session
        const response = await fetch(`http://localhost:8000/api/bookings/${bookingId}/stripe/create-checkout/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.checkout_url) {
                showNotification('Redirecting to Stripe checkout...', 'success');
                
                // Close modal
                closePaymentModal();
                
                // Redirect to Stripe checkout
                window.location.href = data.checkout_url;
            } else {
                showNotification('Failed to create checkout session', 'error');
            }
        } else {
            const errorData = await response.json();
            showNotification(errorData.error || 'Failed to create checkout session', 'error');
        }
        
    } catch (error) {
        console.error('Stripe payment error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Add to Google Calendar
async function addToGoogleCalendar(bookingId) {
    try {
        const booking = allBookings.find(b => b.id === bookingId);
        
        if (!booking) {
            showNotification('Booking not found', 'error');
            return;
        }
        
        showNotification('Opening Google Calendar...', 'info');
        
        // Format date and time for Google Calendar
        const bookingDate = new Date(booking.booking_date + 'T' + booking.booking_time);
        const endDate = new Date(bookingDate.getTime() + (booking.duration * 60000)); // Add duration in milliseconds
        
        // Format dates to Google Calendar format (YYYYMMDDTHHmmss)
        const formatGoogleDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}${month}${day}T${hours}${minutes}${seconds}`;
        };
        
        const startTime = formatGoogleDate(bookingDate);
        const endTime = formatGoogleDate(endDate);
        
        // Create Google Calendar URL
        const calendarUrl = new URL('https://calendar.google.com/calendar/render');
        calendarUrl.searchParams.append('action', 'TEMPLATE');
        calendarUrl.searchParams.append('text', `${booking.service.name} at ${booking.salon.name}`);
        calendarUrl.searchParams.append('dates', `${startTime}/${endTime}`);
        calendarUrl.searchParams.append('details', `Service: ${booking.service.name}\nPrice: ₱${booking.price}\nDuration: ${booking.duration} minutes\nBooking ID: #${booking.id}`);
        calendarUrl.searchParams.append('location', booking.salon.name);
        
        // Open in new tab
        window.open(calendarUrl.toString(), '_blank');
        
        showNotification('Google Calendar opened successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding to calendar:', error);
        showNotification('Failed to open Google Calendar', 'error');
    }
}

// Handle Stripe payment return
async function handleStripePaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const payment = urlParams.get('payment');
    const bookingId = urlParams.get('booking_id');
    const sessionId = urlParams.get('session_id');
    
    if (payment === 'success' && bookingId && sessionId) {
        // Payment successful - verify with backend
        showNotification('Verifying payment...', 'info');
        
        try {
            const accessToken = localStorage.getItem('access_token');
            
            const response = await fetch(`http://localhost:8000/api/bookings/${bookingId}/stripe/verify/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    session_id: sessionId
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success) {
                    showNotification('Payment successful! Your booking is confirmed.', 'success');
                    
                    // Reload bookings after a short delay
                    setTimeout(() => {
                        loadMyBookings();
                    }, 1500);
                } else {
                    showNotification('Payment verification failed. Please contact support.', 'warning');
                }
            } else {
                showNotification('Payment verification failed. Please contact support.', 'error');
            }
            
        } catch (error) {
            console.error('Payment verification error:', error);
            showNotification('Error verifying payment. Please contact support.', 'error');
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
    } else if (payment === 'cancelled' && bookingId) {
        // Payment cancelled
        showNotification('Payment cancelled. You can try again anytime.', 'info');
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}
