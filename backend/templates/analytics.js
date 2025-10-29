/**
 * Google Analytics 4 Event Tracking Helper
 * 
 * This file contains helper functions to track custom events in Google Analytics 4.
 * Import this file after the GA4 gtag script.
 * 
 * Usage:
 * 1. Add GA4 tracking code to your HTML <head>
 * 2. Include this file: <script src="analytics.js"></script>
 * 3. Call functions when events occur: trackRegistration('customer')
 */

// Check if GA is loaded
function isGALoaded() {
    if (typeof gtag === 'undefined') {
        console.warn('Google Analytics not loaded. Events will not be tracked.');
        return false;
    }
    return true;
}

// ==================== USER AUTHENTICATION EVENTS ====================

/**
 * Track user registration
 * @param {string} userType - 'customer' or 'salon_owner'
 * @param {string} method - 'Email' or 'Google'
 */
function trackRegistration(userType, method = 'Email') {
    if (!isGALoaded()) return;
    
    gtag('event', 'sign_up', {
        method: method,
        user_type: userType
    });
    
    console.log(`📊 GA Event: sign_up (${method}, ${userType})`);
}

/**
 * Track user login
 * @param {string} method - 'Email', 'Google', etc.
 * @param {string} userType - 'customer' or 'salon_owner'
 */
function trackLogin(method, userType = null) {
    if (!isGALoaded()) return;
    
    const eventParams = { method: method };
    if (userType) {
        eventParams.user_type = userType;
    }
    
    gtag('event', 'login', eventParams);
    
    console.log(`📊 GA Event: login (${method})`);
}

/**
 * Track user logout
 */
function trackLogout() {
    if (!isGALoaded()) return;
    
    gtag('event', 'logout');
    
    console.log('📊 GA Event: logout');
}

/**
 * Set user properties after login
 * @param {object} user - User object with id, type, email_verified
 */
function setUserProperties(user) {
    if (!isGALoaded()) return;
    
    gtag('set', 'user_properties', {
        user_type: user.user_type || 'unknown',
        user_id: user.id,
        email_verified: user.is_email_verified || false
    });
    
    console.log('📊 GA: User properties set');
}

// ==================== BOOKING EVENTS ====================

/**
 * Track when user starts booking process
 * @param {string} salonName - Name of salon
 * @param {string} serviceName - Name of service
 * @param {number} price - Service price
 */
function trackBookingStart(salonName, serviceName, price) {
    if (!isGALoaded()) return;
    
    gtag('event', 'begin_checkout', {
        currency: 'PHP',
        value: parseFloat(price),
        items: [{
            item_name: serviceName,
            item_brand: salonName,
            price: parseFloat(price),
            item_category: 'Salon Service'
        }]
    });
    
    console.log(`📊 GA Event: begin_checkout (${serviceName} - ₱${price})`);
}

/**
 * Track successful booking creation
 * @param {string} bookingId - Booking ID
 * @param {string} salonName - Salon name
 * @param {string} serviceName - Service name
 * @param {number} price - Total price
 */
function trackBookingComplete(bookingId, salonName, serviceName, price) {
    if (!isGALoaded()) return;
    
    gtag('event', 'booking_created', {
        booking_id: bookingId,
        salon_name: salonName,
        service_name: serviceName,
        value: parseFloat(price),
        currency: 'PHP'
    });
    
    console.log(`📊 GA Event: booking_created (${bookingId})`);
}

/**
 * Track booking cancellation
 * @param {string} bookingId - Booking ID
 * @param {string} cancelledBy - 'customer' or 'salon_owner'
 */
function trackBookingCancel(bookingId, cancelledBy) {
    if (!isGALoaded()) return;
    
    gtag('event', 'booking_cancelled', {
        booking_id: bookingId,
        cancelled_by: cancelledBy
    });
    
    console.log(`📊 GA Event: booking_cancelled (${bookingId})`);
}

// ==================== PAYMENT EVENTS ====================

/**
 * Track payment initiation
 * @param {string} bookingId - Booking ID
 * @param {number} amount - Payment amount
 * @param {string} method - Payment method (PayPal, etc.)
 */
function trackPaymentStart(bookingId, amount, method = 'PayPal') {
    if (!isGALoaded()) return;
    
    gtag('event', 'add_payment_info', {
        currency: 'PHP',
        value: parseFloat(amount),
        payment_type: method,
        transaction_id: bookingId
    });
    
    console.log(`📊 GA Event: add_payment_info (${method} - ₱${amount})`);
}

/**
 * Track successful payment
 * @param {string} bookingId - Booking ID
 * @param {number} amount - Payment amount
 * @param {string} method - Payment method
 * @param {string} transactionId - PayPal transaction ID
 */
function trackPaymentComplete(bookingId, amount, method = 'PayPal', transactionId = null) {
    if (!isGALoaded()) return;
    
    gtag('event', 'purchase', {
        transaction_id: transactionId || bookingId,
        currency: 'PHP',
        value: parseFloat(amount),
        payment_type: method,
        items: [{
            item_id: bookingId,
            price: parseFloat(amount)
        }]
    });
    
    console.log(`📊 GA Event: purchase (${bookingId} - ₱${amount})`);
}

/**
 * Track refund
 * @param {string} bookingId - Booking ID
 * @param {number} amount - Refund amount
 */
function trackRefund(bookingId, amount) {
    if (!isGALoaded()) return;
    
    gtag('event', 'refund', {
        transaction_id: bookingId,
        currency: 'PHP',
        value: parseFloat(amount)
    });
    
    console.log(`📊 GA Event: refund (${bookingId} - ₱${amount})`);
}

// ==================== SEARCH & DISCOVERY ====================

/**
 * Track search queries
 * @param {string} searchTerm - What user searched for
 * @param {number} resultCount - Number of results found
 */
function trackSearch(searchTerm, resultCount = null) {
    if (!isGALoaded()) return;
    
    const eventParams = { search_term: searchTerm };
    if (resultCount !== null) {
        eventParams.result_count = resultCount;
    }
    
    gtag('event', 'search', eventParams);
    
    console.log(`📊 GA Event: search ("${searchTerm}")`);
}

/**
 * Track salon view
 * @param {number} salonId - Salon ID
 * @param {string} salonName - Salon name
 * @param {string} location - Salon location
 */
function trackSalonView(salonId, salonName, location = null) {
    if (!isGALoaded()) return;
    
    const items = [{
        item_id: salonId.toString(),
        item_name: salonName,
        item_category: 'Salon'
    }];
    
    if (location) {
        items[0].item_category2 = location;
    }
    
    gtag('event', 'view_item', {
        items: items
    });
    
    console.log(`📊 GA Event: view_item (${salonName})`);
}

/**
 * Track service selection
 * @param {number} serviceId - Service ID
 * @param {string} serviceName - Service name
 * @param {number} price - Service price
 * @param {string} salonName - Salon name
 */
function trackServiceSelect(serviceId, serviceName, price, salonName) {
    if (!isGALoaded()) return;
    
    gtag('event', 'select_item', {
        items: [{
            item_id: serviceId.toString(),
            item_name: serviceName,
            item_brand: salonName,
            price: parseFloat(price),
            currency: 'PHP'
        }]
    });
    
    console.log(`📊 GA Event: select_item (${serviceName})`);
}

// ==================== USER INTERACTION ====================

/**
 * Track button clicks
 * @param {string} buttonName - Button identifier
 * @param {string} location - Where button is located
 */
function trackButtonClick(buttonName, location = null) {
    if (!isGALoaded()) return;
    
    const eventParams = {
        event_category: 'Button',
        event_label: buttonName
    };
    
    if (location) {
        eventParams.button_location = location;
    }
    
    gtag('event', 'click', eventParams);
    
    console.log(`📊 GA Event: click (${buttonName})`);
}

/**
 * Track form submissions
 * @param {string} formName - Form identifier
 * @param {boolean} success - Whether submission succeeded
 */
function trackFormSubmit(formName, success = true) {
    if (!isGALoaded()) return;
    
    gtag('event', 'form_submit', {
        form_name: formName,
        success: success
    });
    
    console.log(`📊 GA Event: form_submit (${formName})`);
}

/**
 * Track page views manually (if needed)
 * @param {string} pageName - Page name/title
 * @param {string} pagePath - Page path
 */
function trackPageView(pageName, pagePath = null) {
    if (!isGALoaded()) return;
    
    gtag('event', 'page_view', {
        page_title: pageName,
        page_location: window.location.href,
        page_path: pagePath || window.location.pathname
    });
    
    console.log(`📊 GA Event: page_view (${pageName})`);
}

// ==================== CHAT EVENTS ====================

/**
 * Track chat initiation
 * @param {string} salonName - Salon being contacted
 */
function trackChatStart(salonName) {
    if (!isGALoaded()) return;
    
    gtag('event', 'chat_start', {
        salon_name: salonName
    });
    
    console.log(`📊 GA Event: chat_start (${salonName})`);
}

/**
 * Track message sent
 * @param {string} messageType - 'text', 'image', 'gif', 'sticker'
 */
function trackMessageSent(messageType = 'text') {
    if (!isGALoaded()) return;
    
    gtag('event', 'message_sent', {
        message_type: messageType
    });
    
    console.log(`📊 GA Event: message_sent (${messageType})`);
}

// ==================== ERROR TRACKING ====================

/**
 * Track errors
 * @param {string} errorMessage - Error description
 * @param {string} location - Where error occurred
 * @param {boolean} fatal - Whether error is fatal
 */
function trackError(errorMessage, location = null, fatal = false) {
    if (!isGALoaded()) return;
    
    const eventParams = {
        description: errorMessage,
        fatal: fatal
    };
    
    if (location) {
        eventParams.location = location;
    }
    
    gtag('event', 'exception', eventParams);
    
    console.log(`📊 GA Event: exception (${errorMessage})`);
}

// ==================== ENGAGEMENT ====================

/**
 * Track time spent on page
 * @param {string} pageName - Page name
 * @param {number} seconds - Time in seconds
 */
function trackTimeOnPage(pageName, seconds) {
    if (!isGALoaded()) return;
    
    gtag('event', 'timing_complete', {
        name: pageName,
        value: seconds * 1000, // Convert to milliseconds
        event_category: 'Engagement'
    });
    
    console.log(`📊 GA Event: timing_complete (${pageName} - ${seconds}s)`);
}

/**
 * Track scroll depth
 * @param {number} percentage - Scroll percentage (25, 50, 75, 100)
 */
function trackScrollDepth(percentage) {
    if (!isGALoaded()) return;
    
    gtag('event', 'scroll', {
        percent_scrolled: percentage
    });
    
    console.log(`📊 GA Event: scroll (${percentage}%)`);
}

// ==================== PROFILE & SETTINGS ====================

/**
 * Track profile update
 * @param {string} updateType - What was updated
 */
function trackProfileUpdate(updateType) {
    if (!isGALoaded()) return;
    
    gtag('event', 'profile_update', {
        update_type: updateType
    });
    
    console.log(`📊 GA Event: profile_update (${updateType})`);
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Enable debug mode for testing
 */
function enableDebugMode() {
    if (!isGALoaded()) return;
    
    gtag('config', 'debug_mode', true);
    console.log('📊 GA Debug Mode: ENABLED');
}

/**
 * Set custom dimension
 * @param {string} name - Dimension name
 * @param {string} value - Dimension value
 */
function setCustomDimension(name, value) {
    if (!isGALoaded()) return;
    
    gtag('set', name, value);
    console.log(`📊 GA Custom Dimension: ${name} = ${value}`);
}

// ==================== AUTO TRACKING ====================

// Auto-track scroll depth
(function() {
    let scrollMarkers = { 25: false, 50: false, 75: false, 100: false };
    
    window.addEventListener('scroll', function() {
        const scrollPercent = Math.round(
            (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
        );
        
        // Track each milestone once
        [25, 50, 75, 100].forEach(marker => {
            if (scrollPercent >= marker && !scrollMarkers[marker]) {
                trackScrollDepth(marker);
                scrollMarkers[marker] = true;
            }
        });
    });
})();

// Export functions for use in modules (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        trackRegistration,
        trackLogin,
        trackLogout,
        trackBookingStart,
        trackBookingComplete,
        trackBookingCancel,
        trackPaymentStart,
        trackPaymentComplete,
        trackRefund,
        trackSearch,
        trackSalonView,
        trackServiceSelect,
        trackButtonClick,
        trackFormSubmit,
        trackPageView,
        trackChatStart,
        trackMessageSent,
        trackError,
        trackTimeOnPage,
        setUserProperties,
        setCustomDimension
    };
}

console.log('📊 Google Analytics Helper Loaded');
