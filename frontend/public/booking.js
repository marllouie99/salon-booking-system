// Ensure API_BASE_URL is defined (fallback if config.js hasn't loaded yet)
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'https://web-production-e6265.up.railway.app';
    console.warn('⚠️ API_BASE_URL was undefined in booking.js, using fallback:', window.API_BASE_URL);
}

// Booking state
let bookingState = {
    currentStep: 1,
    salonId: null,
    salonName: '',
    selectedService: null,
    selectedDate: null,
    selectedTime: null,
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear()
};

// Show notification function
function showNotification(message, type) {
    // Create notification if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Open booking modal
function openBookingModal(salonId, salonName) {
    bookingState.salonId = salonId;
    bookingState.salonName = salonName;
    bookingState.currentStep = 1;
    
    // Set salon info
    document.getElementById('bookingSalonInfo').innerHTML = `
        <h3>${salonName}</h3>
        <p>Select a service to book your appointment</p>
    `;
    
    // Load services
    loadSalonServices(salonId);
    
    // Show modal
    document.getElementById('bookingModal').classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Reset form
    resetBookingForm();
}

// Close booking modal
function closeBookingModal() {
    document.getElementById('bookingModal').classList.remove('show');
    document.body.style.overflow = 'auto';
    resetBookingForm();
}

// Reset booking form
function resetBookingForm() {
    bookingState.selectedService = null;
    bookingState.selectedDate = null;
    bookingState.selectedTime = null;
    showStep(1);
    updateSummary();
}

// Load salon services
async function loadSalonServices(salonId) {
    try {
        // Get services for specific salon (public endpoint, no auth needed)
        const response = await fetch(`${window.API_BASE_URL}/api/salons/${salonId}/services/`);
        
        if (response.ok) {
            const services = await response.json();
            console.log('Loaded services:', services);
            
            if (services && services.length > 0) {
                displayServices(services);
            } else {
                document.getElementById('servicesSelection').innerHTML = `
                    <p style="text-align: center; color: #64748b;">No services available for this salon yet.</p>
                `;
            }
        } else {
            document.getElementById('servicesSelection').innerHTML = `
                <p style="text-align: center; color: #64748b;">No services available for this salon.</p>
            `;
        }
        
    } catch (error) {
        console.error('Error loading services:', error);
        document.getElementById('servicesSelection').innerHTML = `
            <p style="text-align: center; color: #ef4444;">Failed to load services. Please try again.</p>
        `;
    }
}

// Display services
function displayServices(services) {
    const container = document.getElementById('servicesSelection');
    
    container.innerHTML = services.map(service => {
        // Get first image or use placeholder
        const serviceImage = service.images && service.images.length > 0 
            ? service.images[0] 
            : 'https://via.placeholder.com/300x200?text=' + encodeURIComponent(service.name);
        
        return `
        <div class="service-option-card" onclick="selectService(${service.id}, '${service.name.replace(/'/g, "\\'")}', ${service.price}, ${service.duration})">
            <div class="service-image">
                <img src="${serviceImage}" alt="${service.name}" onerror="this.src='https://via.placeholder.com/300x200?text=Service'">
                <div class="service-price-badge">₱${service.price}</div>
            </div>
            <div class="service-card-info">
                <h4>${service.name}</h4>
                <p class="service-description">${service.description}</p>
                <div class="service-meta">
                    <span><i class="fas fa-clock"></i> ${service.duration} min</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// Select service
function selectService(serviceId, serviceName, price, duration) {
    bookingState.selectedService = {
        id: serviceId,
        name: serviceName,
        price: price,
        duration: duration
    };
    
    // Update UI
    document.querySelectorAll('.service-option-card').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    updateSummary();
}

// Show step
function showStep(step) {
    // Hide all steps
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`step${i}`).style.display = 'none';
    }
    
    // Show current step
    document.getElementById(`step${step}`).style.display = 'block';
    bookingState.currentStep = step;
    
    // Update navigation buttons
    document.getElementById('btnBack').style.display = step > 1 ? 'block' : 'none';
    document.getElementById('btnNext').style.display = step < 4 ? 'block' : 'none';
    
    // Show/hide booking summary - only show on final step (step 4)
    const bookingSummary = document.querySelector('.booking-summary');
    if (bookingSummary) {
        bookingSummary.style.display = step === 4 ? 'block' : 'none';
    }
    
    // Load step-specific content
    if (step === 2) {
        renderCalendar();
    } else if (step === 3 && bookingState.selectedDate) {
        loadAvailableTimeSlots();
    } else if (step === 4) {
        prefillCustomerDetails();
        // Show payment options
        document.getElementById('paypal-button-container').style.display = 'block';
        document.getElementById('btnPayWithCard').style.display = 'block';
        document.getElementById('btnBookWithoutPayment').style.display = 'block';
        // Render PayPal button on final step
        setTimeout(() => renderPayPalButton(), 100);
        
        // Show payment timeout warning
        showPaymentTimeoutWarning();
    }
}

// Next step
function nextStep() {
    const step = bookingState.currentStep;
    
    // Check profile completion before allowing to proceed
    const profileCheck = checkProfileCompletion();
    if (!profileCheck.isComplete) {
        showProfileWarningModal(profileCheck.missingFields);
        return;
    }
    
    // Validation
    if (step === 1 && !bookingState.selectedService) {
        showNotification('Please select a service', 'error');
        return;
    }
    if (step === 2 && !bookingState.selectedDate) {
        showNotification('Please select a date', 'error');
        return;
    }
    if (step === 3 && !bookingState.selectedTime) {
        showNotification('Please select a time slot', 'error');
        return;
    }
    
    showStep(step + 1);
}

// Check if user profile is complete
function checkProfileCompletion() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    
    if (!userData) {
        return { isComplete: false, missingFields: ['User data'] };
    }
    
    const missingFields = [];
    if (!userData.first_name) missingFields.push('First Name');
    if (!userData.last_name) missingFields.push('Last Name');
    if (!userData.phone) missingFields.push('Phone Number');
    if (!userData.address) missingFields.push('Address');
    
    return {
        isComplete: missingFields.length === 0,
        missingFields: missingFields
    };
}

// Show profile warning modal
function showProfileWarningModal(missingFields) {
    const fieldsList = missingFields.join(', ');
    
    // Create modal HTML
    const modalHTML = `
        <div id="profileWarningModal" class="modal show" style="display: flex;">
            <div class="modal-content" style="max-width: 500px; text-align: center;">
                <div class="modal-body">
                    <div style="font-size: 4rem; color: #ffc107; margin-bottom: 1rem;">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2 style="color: #ffffff; margin-bottom: 1rem;">Complete Your Profile</h2>
                    <p style="color: #94a3b8; font-size: 1.1rem; margin-bottom: 1.5rem;">
                        You need to complete your profile before booking an appointment.
                    </p>
                    <div style="background: rgba(255, 193, 7, 0.1); border: 2px solid #ffc107; border-radius: 10px; padding: 1rem; margin-bottom: 2rem;">
                        <p style="color: #ffc107; font-weight: 600; margin-bottom: 0.5rem;">Missing Required Fields:</p>
                        <p style="color: #ffffff; font-size: 1rem;">${fieldsList}</p>
                    </div>
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <button onclick="closeProfileWarningModal()" class="btn-cancel" style="padding: 0.75rem 1.5rem;">
                            Cancel
                        </button>
                        <a href="/profile.html" class="btn-next" style="padding: 0.75rem 1.5rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-user-edit"></i> Complete Profile
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('profileWarningModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close profile warning modal
function closeProfileWarningModal() {
    const modal = document.getElementById('profileWarningModal');
    if (modal) {
        modal.remove();
    }
}

// Previous step
function prevStep() {
    showStep(bookingState.currentStep - 1);
}

// Render calendar
function renderCalendar() {
    const { currentMonth, currentYear } = bookingState;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    document.getElementById('currentMonth').textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date();
    
    let calendarHTML = '';
    
    // Day headers
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        calendarHTML += `<div class="calendar-day-header">${day}</div>`;
    });
    
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        calendarHTML += `<div class="calendar-day disabled"></div>`;
    }
    
    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const isPast = date < today.setHours(0, 0, 0, 0);
        const isToday = date.toDateString() === new Date().toDateString();
        const isSelected = bookingState.selectedDate === date.toISOString().split('T')[0];
        
        const classes = ['calendar-day'];
        if (isPast) classes.push('disabled');
        if (isToday) classes.push('today');
        if (isSelected) classes.push('selected');
        
        calendarHTML += `
            <div class="${classes.join(' ')}" 
                 ${!isPast ? `onclick="selectDate('${date.toISOString().split('T')[0]}')"` : ''}>
                ${day}
            </div>
        `;
    }
    
    document.getElementById('calendarGrid').innerHTML = calendarHTML;
}

// Navigate calendar months
document.addEventListener('DOMContentLoaded', function() {
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            if (bookingState.currentMonth === 0) {
                bookingState.currentMonth = 11;
                bookingState.currentYear--;
            } else {
                bookingState.currentMonth--;
            }
            renderCalendar();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            if (bookingState.currentMonth === 11) {
                bookingState.currentMonth = 0;
                bookingState.currentYear++;
            } else {
                bookingState.currentMonth++;
            }
            renderCalendar();
        });
    }
});

// Select date
function selectDate(date) {
    bookingState.selectedDate = date;
    renderCalendar();
    updateSummary();
}

// Load available time slots
async function loadAvailableTimeSlots() {
    try {
        const container = document.getElementById('timeSlots');
        container.innerHTML = '<div class="loading">Loading available times...</div>';
        
        const response = await fetch(
            `${window.API_BASE_URL}/api/bookings/available-slots/${bookingState.salonId}/?date=${bookingState.selectedDate}`
        );
        
        if (response.ok) {
            const data = await response.json();
            displayTimeSlots(data.available_slots);
        } else {
            container.innerHTML = '<p style="text-align: center; color: #ef4444;">Failed to load time slots</p>';
        }
    } catch (error) {
        console.error('Error loading time slots:', error);
        document.getElementById('timeSlots').innerHTML = 
            '<p style="text-align: center; color: #ef4444;">Network error</p>';
    }
}

// Display time slots
function displayTimeSlots(slots) {
    const container = document.getElementById('timeSlots');
    
    if (slots.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748b;">No available time slots for this date</p>';
        return;
    }
    
    container.innerHTML = slots.map(slot => `
        <div class="time-slot" onclick="selectTime('${slot.time}', '${slot.display}')">
            ${slot.display}
        </div>
    `).join('');
}

// Select time
function selectTime(time, display) {
    bookingState.selectedTime = { time, display };
    
    document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    updateSummary();
}

// Prefill customer details
function prefillCustomerDetails() {
    const userData = JSON.parse(localStorage.getItem('user_data'));
    if (userData) {
        document.getElementById('customerName').value = `${userData.first_name} ${userData.last_name}`;
        document.getElementById('customerEmail').value = userData.email;
        
        // Pre-fill phone if available
        if (userData.phone) {
            document.getElementById('customerPhone').value = userData.phone;
        }
    }
}

// Update summary
function updateSummary() {
    document.getElementById('summaryService').textContent = 
        bookingState.selectedService ? bookingState.selectedService.name : '-';
    document.getElementById('summaryDate').textContent = 
        bookingState.selectedDate ? new Date(bookingState.selectedDate).toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        }) : '-';
    document.getElementById('summaryTime').textContent = 
        bookingState.selectedTime ? bookingState.selectedTime.display : '-';
    document.getElementById('summaryDuration').textContent = 
        bookingState.selectedService ? `${bookingState.selectedService.duration} minutes` : '-';
    document.getElementById('summaryPrice').textContent = 
        bookingState.selectedService ? `₱${bookingState.selectedService.price}` : '₱0';
}

// Create booking and return booking ID
async function createBookingWithoutPayment(paymentMethod = 'pay_later') {
    // Get form field values
    const customerName = document.getElementById('customerName').value.trim();
    const customerEmail = document.getElementById('customerEmail').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    
    // Validate required fields
    if (!customerName) {
        throw new Error('Customer name is required');
    }
    if (!customerEmail) {
        throw new Error('Customer email is required');
    }
    if (!customerPhone) {
        throw new Error('Customer phone is required');
    }
    
    const bookingData = {
        salon_id: bookingState.salonId,
        service_id: bookingState.selectedService.id,
        booking_date: bookingState.selectedDate,
        booking_time: bookingState.selectedTime.time,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        notes: document.getElementById('customerNotes').value || '',
        payment_method: paymentMethod
    };
    
    const accessToken = localStorage.getItem('access_token');
    
    const response = await fetch(`${window.API_BASE_URL}/api/bookings/create/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(bookingData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
        return { success: true, booking: data.booking };
    } else {
        throw new Error(data.error || 'Failed to create booking');
    }
}

// Render PayPal button on final step
function renderPayPalButton() {
    const container = document.getElementById('paypal-button-container');
    
    // Check if PayPal SDK is loaded
    if (typeof paypal === 'undefined') {
        console.log('PayPal SDK not loaded yet, waiting...');
        container.innerHTML = '<p style="text-align: center; color: #667eea;">Loading PayPal...</p>';
        
        // Wait for PayPal SDK to load
        setTimeout(() => {
            if (typeof paypal !== 'undefined') {
                renderPayPalButton();
            } else {
                // PayPal failed to load, hide container
                container.style.display = 'none';
                // Pay Later button is already visible
            }
        }, 2000);
        return;
    }
    
    container.innerHTML = ''; // Clear any existing buttons
    
    paypal.Buttons({
        createOrder: async function(data, actions) {
            try {
                showNotification('Creating booking...', 'info');
                
                // Create booking first with PayPal payment method
                const result = await createBookingWithoutPayment('paypal');
                
                if (!result.success) {
                    throw new Error('Failed to create booking');
                }
                
                // Store booking ID for later
                bookingState.bookingId = result.booking.id;
                
                // Create PayPal order
                return actions.order.create({
                    purchase_units: [{
                        amount: {
                            value: bookingState.selectedService.price.toString()
                        },
                        description: `${bookingState.salonName} - ${bookingState.selectedService.name}`
                    }]
                });
            } catch (error) {
                console.error('Error:', error);
                showNotification(error.message, 'error');
                throw error;
            }
        },
        onApprove: async function(data, actions) {
            try {
                showNotification('Processing payment...', 'info');
                
                // Capture the payment
                const order = await actions.order.capture();
                console.log('Payment successful:', order);
                
                // Update booking payment status in backend
                const accessToken = localStorage.getItem('access_token');
                console.log('Updating payment status for booking:', bookingState.bookingId);
                console.log('PayPal Order ID:', order.id);
                
                const updateResponse = await fetch(`${window.API_BASE_URL}/api/bookings/${bookingState.bookingId}/update-payment-status/`, {
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
                
                const updateData = await updateResponse.json();
                console.log('Update response:', updateResponse.status, updateData);
                
                if (updateResponse.ok) {
                    showNotification('Payment successful! Booking confirmed!', 'success');
                } else {
                    console.error('Failed to update payment status:', updateData);
                    showNotification('Payment received but status update failed', 'warning');
                }
                
                closeBookingModal();
                
                // Redirect to My Bookings
                setTimeout(() => {
                    window.location.href = '/my-bookings';
                }, 2000);
                
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
    }).render('#paypal-button-container');
}

// Book without payment (fallback)
async function bookWithoutPayment() {
    try {
        showNotification('Creating booking...', 'info');
        
        const result = await createBookingWithoutPayment();
        
        if (result.success) {
            showNotification('Booking created! You can pay at the salon.', 'success');
            closeBookingModal();
            
            setTimeout(() => {
                window.location.href = '/my-bookings';
            }, 2000);
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification(error.message, 'error');
    }
}

// Pay with Credit Card (Stripe)
async function payWithCreditCard() {
    try {
        showNotification('Processing...', 'info');
        
        // First create the booking
        const result = await createBookingWithStripe();
        
        if (result.success && result.bookingId) {
            // Create Stripe checkout session
            const accessToken = localStorage.getItem('access_token');
            const response = await fetch(`${window.API_BASE_URL}/api/bookings/${result.bookingId}/stripe/create-checkout/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Stripe checkout error:', response.status, errorText);
                throw new Error(`Failed to create checkout session (${response.status})`);
            }
            
            const data = await response.json();
            
            if (data.checkout_url) {
                showNotification('Redirecting to payment...', 'info');
                // Redirect to Stripe checkout
                window.location.href = data.checkout_url;
            } else {
                throw new Error(data.error || 'Failed to create checkout session');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification(error.message, 'error');
    }
}

// Create booking with Stripe payment method
async function createBookingWithStripe() {
    const accessToken = localStorage.getItem('access_token');
    
    if (!accessToken) {
        throw new Error('Please login to continue');
    }
    
    // Validate required fields
    const customerName = document.getElementById('customerName').value.trim();
    const customerEmail = document.getElementById('customerEmail').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    
    if (!customerName) {
        throw new Error('Customer name is required');
    }
    if (!customerEmail) {
        throw new Error('Customer email is required');
    }
    if (!customerPhone) {
        throw new Error('Customer phone is required');
    }
    
    const bookingData = {
        salon_id: bookingState.salonId,
        service_id: bookingState.selectedService.id,
        booking_date: bookingState.selectedDate,
        booking_time: bookingState.selectedTime.time,  // Fixed: use .time property
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        notes: document.getElementById('customerNotes').value || '',
        payment_method: 'stripe'
    };
    
    const response = await fetch(`${window.API_BASE_URL}/api/bookings/create/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(bookingData)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || 'Failed to create booking');
    }
    
    return {
        success: true,
        bookingId: data.booking.id,
        booking: data.booking
    };
}

// Show payment timeout warning
function showPaymentTimeoutWarning() {
    const existingWarning = document.getElementById('payment-timeout-warning');
    if (existingWarning) {
        return; // Already shown
    }
    
    const warningHTML = `
        <div id="payment-timeout-warning" style="
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-left: 4px solid #f59e0b;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: start;
            gap: 0.75rem;
        ">
            <i class="fas fa-clock" style="color: #d97706; font-size: 1.25rem; margin-top: 0.125rem;"></i>
            <div style="flex: 1;">
                <strong style="color: #92400e; display: block; margin-bottom: 0.25rem;">
                    Complete payment within 15 minutes
                </strong>
                <p style="color: #78350f; font-size: 0.9rem; margin: 0; line-height: 1.4;">
                    Your time slot will be reserved for 15 minutes. Please complete the payment process to confirm your booking.
                </p>
            </div>
        </div>
    `;
    
    const paymentSection = document.querySelector('.payment-options-section');
    if (paymentSection) {
        paymentSection.insertAdjacentHTML('beforebegin', warningHTML);
    }
}
