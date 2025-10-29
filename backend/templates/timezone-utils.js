// Timezone utilities for GMT+8 (Asia/Manila)
const TIMEZONE = 'Asia/Manila';
const GMT_OFFSET = 8;

// Get current date in GMT+8
function getCurrentDateGMT8() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

// Convert any date to GMT+8
function toGMT8(date) {
    if (!date) return null;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Date(dateObj.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

// Format date in GMT+8
function formatDateGMT8(date, options = {}) {
    if (!date) return 'N/A';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString('en-US', { 
        timeZone: TIMEZONE,
        ...options
    });
}

// Get date string for comparison (YYYY-MM-DD in GMT+8)
function getDateStringGMT8(date) {
    if (!date) return '';
    const gmt8Date = toGMT8(date);
    const year = gmt8Date.getFullYear();
    const month = String(gmt8Date.getMonth() + 1).padStart(2, '0');
    const day = String(gmt8Date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Check if two dates are the same day in GMT+8
function isSameDayGMT8(date1, date2) {
    return getDateStringGMT8(date1) === getDateStringGMT8(date2);
}

// Get start of day in GMT+8
function getStartOfDayGMT8(date) {
    const gmt8Date = toGMT8(date);
    gmt8Date.setHours(0, 0, 0, 0);
    return gmt8Date;
}

// Get end of day in GMT+8
function getEndOfDayGMT8(date) {
    const gmt8Date = toGMT8(date);
    gmt8Date.setHours(23, 59, 59, 999);
    return gmt8Date;
}

// Format date for display (e.g., "Oct 30, 2025")
function formatDisplayDateGMT8(date) {
    return formatDateGMT8(date, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format time for display (e.g., "4:00 PM")
function formatDisplayTimeGMT8(date) {
    return formatDateGMT8(date, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Get date range for last N days in GMT+8
function getLastNDaysGMT8(n) {
    const dates = [];
    const today = getCurrentDateGMT8();
    
    for (let i = n - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        dates.push(date);
    }
    
    return dates;
}
