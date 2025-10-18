// Reviews Management System
// Handles review display, submission, and management with JWT token refresh

const API_BASE_URL = 'http://localhost:8000';

// ============================================
// JWT TOKEN REFRESH FUNCTIONS (from chat.js pattern)
// ============================================

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    
    if (!refreshToken) {
        console.error('No refresh token available');
        window.location.href = '/';
        return null;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/accounts/token/refresh/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refresh: refreshToken
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('access_token', data.access);
            return data.access;
        } else {
            console.error('Failed to refresh token');
            localStorage.clear();
            window.location.href = '/';
            return null;
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
        localStorage.clear();
        window.location.href = '/';
        return null;
    }
}

/**
 * Authenticated fetch with automatic token refresh on 401
 */
async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        throw new Error('No access token available');
    }
    
    // Set up headers
    const headers = options.headers || {};
    headers['Authorization'] = `Bearer ${token}`;
    
    // Don't set Content-Type for FormData
    if (!options.isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    
    const fetchOptions = {
        ...options,
        headers
    };
    
    try {
        let response = await fetch(url, fetchOptions);
        
        // If 401, try to refresh token and retry
        if (response.status === 401) {
            console.log('Token expired, refreshing...');
            const newToken = await refreshAccessToken();
            
            if (newToken) {
                // Retry with new token
                headers['Authorization'] = `Bearer ${newToken}`;
                fetchOptions.headers = headers;
                response = await fetch(url, fetchOptions);
            }
        }
        
        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

// ============================================
// REVIEW DISPLAY FUNCTIONS
// ============================================

/**
 * Load and display reviews for a salon
 */
async function loadSalonReviews(salonId, page = 1, rating = null) {
    try {
        let url = `${API_BASE_URL}/api/salons/${salonId}/reviews/?page=${page}&page_size=10`;
        if (rating) {
            url += `&rating=${rating}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (response.ok) {
            return data;
        } else {
            console.error('Error loading reviews:', data);
            return null;
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
        return null;
    }
}

/**
 * Display reviews in a container
 */
function displayReviews(reviews, containerId) {
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.error('Reviews container not found');
        return;
    }
    
    if (!reviews || reviews.length === 0) {
        container.innerHTML = `
            <div class="no-reviews">
                <p>No reviews yet. Be the first to review!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = reviews.map(review => createReviewCard(review)).join('');
}

/**
 * Create HTML for a single review card
 */
function createReviewCard(review) {
    const stars = '⭐'.repeat(review.rating);
    const verifiedBadge = review.is_verified_booking ? 
        '<span class="verified-badge">✓ Verified Booking</span>' : '';
    
    const detailedRatings = (review.service_quality || review.cleanliness || 
                            review.value_for_money || review.staff_friendliness) ? `
        <div class="detailed-ratings">
            ${review.service_quality ? `<span>Service Quality: ${'⭐'.repeat(review.service_quality)}</span>` : ''}
            ${review.cleanliness ? `<span>Cleanliness: ${'⭐'.repeat(review.cleanliness)}</span>` : ''}
            ${review.value_for_money ? `<span>Value: ${'⭐'.repeat(review.value_for_money)}</span>` : ''}
            ${review.staff_friendliness ? `<span>Staff: ${'⭐'.repeat(review.staff_friendliness)}</span>` : ''}
        </div>
    ` : '';
    
    const salonResponse = review.salon_response ? `
        <div class="salon-response">
            <strong>💬 Salon Response:</strong>
            <p>${escapeHtml(review.salon_response)}</p>
            <small>${formatDate(review.salon_response_date)}</small>
        </div>
    ` : '';
    
    const editButton = review.can_edit ? `
        <button class="btn-edit-review" onclick="editReview(${review.id})">
            <i class="fas fa-edit"></i> Edit
        </button>
    ` : '';
    
    const respondButton = review.can_respond && !review.salon_response ? `
        <button class="btn-respond" onclick="showRespondModal(${review.id})">
            <i class="fas fa-reply"></i> Respond
        </button>
    ` : '';
    
    return `
        <div class="review-card" data-review-id="${review.id}">
            <div class="review-header">
                <div class="reviewer-info">
                    <div class="reviewer-avatar">${review.customer_name.charAt(0).toUpperCase()}</div>
                    <div>
                        <strong>${escapeHtml(review.customer_name)}</strong>
                        ${verifiedBadge}
                        <div class="review-date">${formatDate(review.created_at)}</div>
                    </div>
                </div>
                <div class="review-rating">${stars}</div>
            </div>
            
            ${review.title ? `<h4 class="review-title">${escapeHtml(review.title)}</h4>` : ''}
            
            <p class="review-comment">${escapeHtml(review.comment)}</p>
            
            ${detailedRatings}
            ${salonResponse}
            
            <div class="review-footer">
                <button class="btn-helpful" onclick="markReviewHelpful(${review.id})">
                    👍 Helpful (${review.helpful_count})
                </button>
                ${editButton}
                ${respondButton}
            </div>
        </div>
    `;
}

/**
 * Display average rating and breakdown
 */
function displayRatingSummary(data, containerId) {
    const container = document.getElementById(containerId);
    
    if (!container) return;
    
    const stars = '⭐'.repeat(Math.round(data.average_rating));
    const breakdown = data.rating_breakdown;
    
    const totalReviews = Object.values(breakdown).reduce((a, b) => a + b, 0);
    
    container.innerHTML = `
        <div class="rating-summary">
            <div class="average-rating">
                <div class="rating-number">${data.average_rating.toFixed(1)}</div>
                <div class="rating-stars">${stars}</div>
                <div class="rating-count">${totalReviews} reviews</div>
            </div>
            
            <div class="rating-breakdown">
                ${[5, 4, 3, 2, 1].map(rating => {
                    const count = breakdown[rating] || 0;
                    const percentage = totalReviews > 0 ? (count / totalReviews * 100) : 0;
                    return `
                        <div class="rating-bar">
                            <span class="rating-label">${rating}★</span>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${percentage}%"></div>
                            </div>
                            <span class="rating-count">${count}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// ============================================
// REVIEW SUBMISSION
// ============================================

/**
 * Submit a new review
 */
async function submitReview(reviewData) {
    try {
        const response = await authenticatedFetch(
            `${API_BASE_URL}/api/salons/${reviewData.salon}/reviews/`,
            {
                method: 'POST',
                body: JSON.stringify(reviewData)
            }
        );
        
        const data = await response.json();
        
        if (response.ok) {
            return { success: true, data };
        } else {
            return { success: false, error: data };
        }
    } catch (error) {
        console.error('Error submitting review:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Show review submission modal
 */
function showReviewModal(salonId, salonName, bookingId = null) {
    const modal = document.getElementById('review-modal');
    if (!modal) {
        console.error('Review modal not found');
        return;
    }
    
    document.getElementById('review-salon-name').textContent = salonName;
    document.getElementById('review-salon-id').value = salonId;
    document.getElementById('review-booking-id').value = bookingId || '';
    
    // Reset form
    document.getElementById('review-form').reset();
    updateStarDisplay('rating', 5);
    
    modal.style.display = 'block';
}

/**
 * Hide review modal
 */
function hideReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Handle review form submission
 */
async function handleReviewSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    const reviewData = {
        salon: parseInt(document.getElementById('review-salon-id').value),
        rating: parseInt(document.getElementById('rating').value),
        title: document.getElementById('review-title').value,
        comment: document.getElementById('review-comment').value,
        service_quality: parseInt(document.getElementById('service-quality').value) || null,
        cleanliness: parseInt(document.getElementById('cleanliness').value) || null,
        value_for_money: parseInt(document.getElementById('value-for-money').value) || null,
        staff_friendliness: parseInt(document.getElementById('staff-friendliness').value) || null
    };
    
    const bookingId = document.getElementById('review-booking-id').value;
    if (bookingId) {
        reviewData.booking = parseInt(bookingId);
    }
    
    const result = await submitReview(reviewData);
    
    if (result.success) {
        showNotification('Review submitted successfully! It will be visible after admin approval.', 'success');
        hideReviewModal();
        
        // Reload reviews if on salon page
        if (typeof loadSalonReviews === 'function') {
            const salonId = reviewData.salon;
            const reviewsData = await loadSalonReviews(salonId);
            if (reviewsData) {
                displayReviews(reviewsData.reviews, 'reviews-list');
                displayRatingSummary(reviewsData, 'rating-summary');
            }
        }
    } else {
        showNotification('Error: ' + JSON.stringify(result.error), 'error');
    }
    
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Review';
}

// ============================================
// REVIEW ACTIONS
// ============================================

/**
 * Mark a review as helpful
 */
async function markReviewHelpful(reviewId) {
    try {
        const response = await authenticatedFetch(
            `${API_BASE_URL}/api/salons/reviews/${reviewId}/helpful/`,
            { method: 'POST' }
        );
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(data.message, 'success');
            
            // Update helpful count in UI
            const reviewCard = document.querySelector(`[data-review-id="${reviewId}"]`);
            if (reviewCard) {
                const helpfulBtn = reviewCard.querySelector('.btn-helpful');
                if (helpfulBtn) {
                    helpfulBtn.textContent = `👍 Helpful (${data.helpful_count})`;
                }
            }
        } else {
            showNotification('Error marking review as helpful', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Please log in to mark reviews as helpful', 'info');
    }
}

/**
 * Show respond to review modal
 */
function showRespondModal(reviewId) {
    const modal = document.getElementById('respond-modal');
    if (!modal) {
        console.error('Respond modal not found');
        return;
    }
    
    document.getElementById('respond-review-id').value = reviewId;
    document.getElementById('salon-response-text').value = '';
    
    modal.style.display = 'block';
}

/**
 * Hide respond modal
 */
function hideRespondModal() {
    const modal = document.getElementById('respond-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Submit salon response to review
 */
async function submitSalonResponse(event) {
    event.preventDefault();
    
    const reviewId = document.getElementById('respond-review-id').value;
    const response_text = document.getElementById('salon-response-text').value;
    
    try {
        const response = await authenticatedFetch(
            `${API_BASE_URL}/api/salons/reviews/${reviewId}/respond/`,
            {
                method: 'POST',
                body: JSON.stringify({ salon_response: response_text })
            }
        );
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Response submitted successfully!', 'success');
            hideRespondModal();
            
            // Reload the review
            location.reload();
        } else {
            showNotification('Error: ' + JSON.stringify(data), 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error submitting response', 'error');
    }
}

// ============================================
// ADMIN MODERATION
// ============================================

/**
 * Load pending reviews for admin
 */
async function loadPendingReviews() {
    try {
        const response = await authenticatedFetch(
            `${API_BASE_URL}/api/salons/reviews/pending/`
        );
        
        const data = await response.json();
        
        if (response.ok) {
            return data.reviews;
        } else {
            console.error('Error loading pending reviews:', data);
            return [];
        }
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

/**
 * Moderate review (approve/reject)
 */
async function moderateReview(reviewId, action, notes = '') {
    try {
        const response = await authenticatedFetch(
            `${API_BASE_URL}/api/salons/reviews/${reviewId}/moderate/`,
            {
                method: 'POST',
                body: JSON.stringify({ action, notes })
            }
        );
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(data.message, 'success');
            return true;
        } else {
            showNotification('Error: ' + JSON.stringify(data), 'error');
            return false;
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error moderating review', 'error');
        return false;
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Update star rating display
 */
function updateStarDisplay(inputId, value) {
    const input = document.getElementById(inputId);
    if (input) {
        input.value = value;
        
        // Update star display
        const container = input.closest('.star-rating');
        if (container) {
            const stars = container.querySelectorAll('.star');
            stars.forEach((star, index) => {
                if (index < value) {
                    star.classList.add('active');
                } else {
                    star.classList.remove('active');
                }
            });
        }
    }
}

/**
 * Initialize star rating inputs
 */
function initializeStarRatings() {
    document.querySelectorAll('.star-rating').forEach(container => {
        const input = container.querySelector('input[type="hidden"]');
        const stars = container.querySelectorAll('.star');
        
        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                const rating = index + 1;
                updateStarDisplay(input.id, rating);
            });
        });
    });
}

/**
 * Format date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    // Check if notification function exists
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        alert(message);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeStarRatings();
    
    // Attach form handlers if forms exist
    const reviewForm = document.getElementById('review-form');
    if (reviewForm) {
        reviewForm.addEventListener('submit', handleReviewSubmit);
    }
    
    const respondForm = document.getElementById('respond-form');
    if (respondForm) {
        respondForm.addEventListener('submit', submitSalonResponse);
    }
});
