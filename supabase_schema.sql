-- ============================================
-- SALON BOOKING SYSTEM - SUPABASE SCHEMA
-- ============================================
-- This SQL file contains the complete database schema for the Salon Booking System
-- Compatible with PostgreSQL (Supabase)
-- Generated: 2025-10-18
-- ============================================

-- Enable UUID extension for PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ACCOUNTS APP - User Management
-- ============================================

-- Custom User Table (extends Django's AbstractUser)
CREATE TABLE accounts_user (
    id BIGSERIAL PRIMARY KEY,
    password VARCHAR(128) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    username VARCHAR(150) UNIQUE NOT NULL,
    first_name VARCHAR(150) NOT NULL DEFAULT '',
    last_name VARCHAR(150) NOT NULL DEFAULT '',
    email VARCHAR(254) NOT NULL DEFAULT '',
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    date_joined TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Custom fields
    user_type VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (user_type IN ('customer', 'salon_owner', 'admin')),
    phone VARCHAR(20),
    profile_picture VARCHAR(255),
    date_of_birth DATE,
    address TEXT,
    
    -- Email verification
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_code VARCHAR(6),
    verification_code_expires TIMESTAMP WITH TIME ZONE,
    
    -- Password reset
    password_reset_code VARCHAR(6),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for User table
CREATE INDEX idx_user_username ON accounts_user(username);
CREATE INDEX idx_user_email ON accounts_user(email);
CREATE INDEX idx_user_type ON accounts_user(user_type);
CREATE INDEX idx_user_created_at ON accounts_user(created_at);

-- ============================================
-- 2. SALONS APP - Salon Management
-- ============================================

-- Salon Applications Table
CREATE TABLE salons_salonapplication (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
    
    -- Salon information
    salon_name VARCHAR(255) NOT NULL,
    business_email VARCHAR(254) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    website VARCHAR(200),
    
    -- Location
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    
    -- Services (JSON array)
    services JSONB NOT NULL DEFAULT '[]',
    
    -- Details
    description TEXT NOT NULL,
    years_in_business INTEGER NOT NULL,
    staff_count INTEGER NOT NULL,
    application_reason TEXT,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    reviewed_by_id BIGINT REFERENCES accounts_user(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for Salon Applications
CREATE INDEX idx_salonapplication_user ON salons_salonapplication(user_id);
CREATE INDEX idx_salonapplication_status ON salons_salonapplication(status);
CREATE INDEX idx_salonapplication_created_at ON salons_salonapplication(created_at DESC);

-- Salons Table
CREATE TABLE salons_salon (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
    application_id BIGINT UNIQUE REFERENCES salons_salonapplication(id) ON DELETE SET NULL,
    
    -- Basic information
    name VARCHAR(255) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    website VARCHAR(200),
    
    -- Location
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    latitude DECIMAL(9, 6),
    longitude DECIMAL(9, 6),
    
    -- Details
    description TEXT NOT NULL,
    services JSONB NOT NULL DEFAULT '[]',
    
    -- Media
    logo VARCHAR(255),
    cover_image VARCHAR(255),
    
    -- Ratings and stats
    rating DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    years_in_business INTEGER NOT NULL DEFAULT 0,
    staff_count INTEGER NOT NULL DEFAULT 0,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for Salons
CREATE INDEX idx_salon_owner ON salons_salon(owner_id);
CREATE INDEX idx_salon_city ON salons_salon(city);
CREATE INDEX idx_salon_rating ON salons_salon(rating DESC);
CREATE INDEX idx_salon_is_active ON salons_salon(is_active);
CREATE INDEX idx_salon_is_featured ON salons_salon(is_featured);
CREATE INDEX idx_salon_created_at ON salons_salon(created_at DESC);

-- Services Table
CREATE TABLE salons_service (
    id BIGSERIAL PRIMARY KEY,
    salon_id BIGINT NOT NULL REFERENCES salons_salon(id) ON DELETE CASCADE,
    
    -- Service details
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    duration INTEGER NOT NULL, -- Duration in minutes
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for Services
CREATE INDEX idx_service_salon ON salons_service(salon_id);
CREATE INDEX idx_service_is_active ON salons_service(is_active);
CREATE INDEX idx_service_name ON salons_service(name);

-- Service Images Table
CREATE TABLE salons_serviceimage (
    id BIGSERIAL PRIMARY KEY,
    service_id BIGINT NOT NULL REFERENCES salons_service(id) ON DELETE CASCADE,
    image VARCHAR(255) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for Service Images
CREATE INDEX idx_serviceimage_service ON salons_serviceimage(service_id);
CREATE INDEX idx_serviceimage_is_primary ON salons_serviceimage(is_primary);

-- ============================================
-- 3. BOOKINGS APP - Booking Management
-- ============================================

-- Bookings Table (MOVED BEFORE REVIEWS to fix foreign key dependency)
CREATE TABLE bookings_booking (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
    salon_id BIGINT NOT NULL REFERENCES salons_salon(id) ON DELETE CASCADE,
    service_id BIGINT NOT NULL REFERENCES salons_service(id) ON DELETE CASCADE,
    
    -- Booking details
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    duration INTEGER NOT NULL, -- Duration in minutes
    
    -- Customer information
    customer_name VARCHAR(200) NOT NULL,
    customer_email VARCHAR(254) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    notes TEXT,
    
    -- Status and pricing
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    price DECIMAL(10, 2) NOT NULL,
    
    -- Payment information
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'refunded', 'failed')),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'paypal' CHECK (payment_method IN ('paypal', 'stripe', 'pay_later', 'cash', 'card')),
    payment_id VARCHAR(255),
    paypal_order_id VARCHAR(255),
    
    -- Google Calendar integration
    google_calendar_event_id VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for Bookings
CREATE INDEX idx_booking_customer ON bookings_booking(customer_id);
CREATE INDEX idx_booking_salon ON bookings_booking(salon_id);
CREATE INDEX idx_booking_service ON bookings_booking(service_id);
CREATE INDEX idx_booking_status ON bookings_booking(status);
CREATE INDEX idx_booking_date ON bookings_booking(booking_date);
CREATE INDEX idx_booking_created_at ON bookings_booking(created_at DESC);

-- Transactions Table
CREATE TABLE bookings_transaction (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings_booking(id) ON DELETE CASCADE,
    customer_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
    salon_id BIGINT NOT NULL REFERENCES salons_salon(id) ON DELETE CASCADE,
    
    -- Transaction details
    transaction_type VARCHAR(20) NOT NULL DEFAULT 'payment' CHECK (transaction_type IN ('payment', 'refund', 'partial_refund', 'fee', 'payout')),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
    
    -- Payment provider details
    payment_method VARCHAR(20) NOT NULL DEFAULT 'paypal' CHECK (payment_method IN ('paypal', 'pay_later', 'cash', 'stripe', 'bank_transfer', 'credit_card')),
    payment_provider_id VARCHAR(255),
    payment_provider_transaction_id VARCHAR(255),
    
    -- Additional details
    description TEXT,
    platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    salon_payout DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for Transactions
CREATE INDEX idx_transaction_booking ON bookings_transaction(booking_id);
CREATE INDEX idx_transaction_status_created ON bookings_transaction(status, created_at DESC);
CREATE INDEX idx_transaction_customer_created ON bookings_transaction(customer_id, created_at DESC);
CREATE INDEX idx_transaction_salon_created ON bookings_transaction(salon_id, created_at DESC);
CREATE INDEX idx_transaction_payment_provider_id ON bookings_transaction(payment_provider_id);

-- Chat Table
CREATE TABLE bookings_chat (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
    salon_id BIGINT NOT NULL REFERENCES salons_salon(id) ON DELETE CASCADE,
    booking_id BIGINT REFERENCES bookings_booking(id) ON DELETE SET NULL,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(customer_id, salon_id)
);

-- Indexes for Chat
CREATE INDEX idx_chat_customer ON bookings_chat(customer_id);
CREATE INDEX idx_chat_salon ON bookings_chat(salon_id);
CREATE INDEX idx_chat_updated_at ON bookings_chat(updated_at DESC);

-- Message Table
CREATE TABLE bookings_message (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL REFERENCES bookings_chat(id) ON DELETE CASCADE,
    sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('customer', 'salon')),
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'gif', 'sticker', 'booking_inquiry', 'booking_update', 'system')),
    content TEXT NOT NULL,
    image VARCHAR(255),
    
    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Optional: Link to specific booking
    related_booking_id BIGINT REFERENCES bookings_booking(id) ON DELETE SET NULL,
    
    -- Message metadata
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Indexes for Messages
CREATE INDEX idx_message_chat ON bookings_message(chat_id);
CREATE INDEX idx_message_sent_at ON bookings_message(sent_at DESC);
CREATE INDEX idx_message_is_read ON bookings_message(is_read);

-- ============================================
-- BACK TO SALONS APP - Reviews (moved here due to foreign key dependency on bookings_booking)
-- ============================================

-- Reviews Table
CREATE TABLE salons_review (
    id BIGSERIAL PRIMARY KEY,
    salon_id BIGINT NOT NULL REFERENCES salons_salon(id) ON DELETE CASCADE,
    customer_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
    booking_id BIGINT UNIQUE REFERENCES bookings_booking(id) ON DELETE SET NULL,
    
    -- Review details
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(200),
    comment TEXT NOT NULL,
    
    -- Additional ratings (optional)
    service_quality INTEGER CHECK (service_quality >= 1 AND service_quality <= 5),
    cleanliness INTEGER CHECK (cleanliness >= 1 AND cleanliness <= 5),
    value_for_money INTEGER CHECK (value_for_money >= 1 AND value_for_money <= 5),
    staff_friendliness INTEGER CHECK (staff_friendliness >= 1 AND staff_friendliness <= 5),
    
    -- Moderation
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    is_verified_booking BOOLEAN NOT NULL DEFAULT FALSE,
    moderated_by_id BIGINT REFERENCES accounts_user(id) ON DELETE SET NULL,
    moderation_notes TEXT,
    
    -- Engagement
    helpful_count INTEGER NOT NULL DEFAULT 0,
    
    -- Salon response
    salon_response TEXT,
    salon_response_date TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(customer_id, salon_id, booking_id)
);

-- Indexes for Reviews
CREATE INDEX idx_review_salon_status_created ON salons_review(salon_id, status, created_at DESC);
CREATE INDEX idx_review_customer_created ON salons_review(customer_id, created_at DESC);
CREATE INDEX idx_review_rating ON salons_review(rating);

-- ============================================
-- 4. NOTIFICATIONS APP - Notification System
-- ============================================

-- Notifications Table
CREATE TABLE notifications_notification (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
    
    -- Notification details
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'application_approved', 'application_rejected', 'application_pending',
        'booking_confirmed', 'booking_cancelled', 'booking_completed', 'booking_reminder',
        'review_received', 'review_response', 'message_received',
        'payment_success', 'payment_failed', 'system', 'info'
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Read status
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Action URL
    action_url VARCHAR(500),
    
    -- Generic relation fields (for Django ContentType)
    content_type_id INTEGER,
    object_id INTEGER,
    
    -- Additional metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for Notifications
CREATE INDEX idx_notification_user_read_created ON notifications_notification(user_id, is_read, created_at DESC);
CREATE INDEX idx_notification_user_type_created ON notifications_notification(user_id, notification_type, created_at DESC);

-- ============================================
-- 5. DJANGO SYSTEM TABLES
-- ============================================

-- Django Content Types
CREATE TABLE django_content_type (
    id SERIAL PRIMARY KEY,
    app_label VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    UNIQUE(app_label, model)
);

-- Django Migrations
CREATE TABLE django_migrations (
    id BIGSERIAL PRIMARY KEY,
    app VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    applied TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Django Session
CREATE TABLE django_session (
    session_key VARCHAR(40) PRIMARY KEY,
    session_data TEXT NOT NULL,
    expire_date TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_django_session_expire_date ON django_session(expire_date);

-- Django Admin Log
CREATE TABLE django_admin_log (
    id SERIAL PRIMARY KEY,
    action_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    object_id TEXT,
    object_repr VARCHAR(200) NOT NULL,
    action_flag SMALLINT NOT NULL CHECK (action_flag >= 0),
    change_message TEXT NOT NULL,
    content_type_id INTEGER REFERENCES django_content_type(id) ON DELETE SET NULL,
    user_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE
);

CREATE INDEX idx_admin_log_content_type ON django_admin_log(content_type_id);
CREATE INDEX idx_admin_log_user ON django_admin_log(user_id);

-- ============================================
-- 6. TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_accounts_user_updated_at BEFORE UPDATE ON accounts_user
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salons_salonapplication_updated_at BEFORE UPDATE ON salons_salonapplication
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salons_salon_updated_at BEFORE UPDATE ON salons_salon
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salons_service_updated_at BEFORE UPDATE ON salons_service
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salons_review_updated_at BEFORE UPDATE ON salons_review
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_booking_updated_at BEFORE UPDATE ON bookings_booking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_transaction_updated_at BEFORE UPDATE ON bookings_transaction
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_chat_updated_at BEFORE UPDATE ON bookings_chat
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_notification_updated_at BEFORE UPDATE ON notifications_notification
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Uncomment and customize these policies based on your security requirements

-- Enable RLS on tables
-- ALTER TABLE accounts_user ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE salons_salon ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bookings_booking ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications_notification ENABLE ROW LEVEL SECURITY;

-- Example: Users can only view their own data
-- CREATE POLICY user_select_own ON accounts_user
--     FOR SELECT USING (auth.uid() = id::text);

-- Example: Salon owners can view their own salons
-- CREATE POLICY salon_owner_select ON salons_salon
--     FOR SELECT USING (auth.uid() = owner_id::text);

-- ============================================
-- 8. USEFUL VIEWS
-- ============================================

-- View: Active Salons with Owner Info
CREATE OR REPLACE VIEW view_active_salons AS
SELECT 
    s.id,
    s.name,
    s.email,
    s.phone,
    s.address,
    s.city,
    s.state,
    s.rating,
    s.total_reviews,
    s.is_featured,
    s.is_verified,
    u.username as owner_username,
    u.email as owner_email,
    s.created_at
FROM salons_salon s
JOIN accounts_user u ON s.owner_id = u.id
WHERE s.is_active = TRUE
ORDER BY s.rating DESC, s.total_reviews DESC;

-- View: Booking Summary
CREATE OR REPLACE VIEW view_booking_summary AS
SELECT 
    b.id,
    b.booking_date,
    b.booking_time,
    b.status,
    b.payment_status,
    c.username as customer_username,
    c.email as customer_email,
    s.name as salon_name,
    sv.name as service_name,
    b.price,
    b.created_at
FROM bookings_booking b
JOIN accounts_user c ON b.customer_id = c.id
JOIN salons_salon s ON b.salon_id = s.id
JOIN salons_service sv ON b.service_id = sv.id
ORDER BY b.booking_date DESC, b.booking_time DESC;

-- View: Unread Notifications Count per User
CREATE OR REPLACE VIEW view_unread_notifications AS
SELECT 
    user_id,
    COUNT(*) as unread_count
FROM notifications_notification
WHERE is_read = FALSE
GROUP BY user_id;

-- ============================================
-- 9. SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample admin user (password: admin123 - hashed with Django's PBKDF2)
-- Note: You should change this password after first login
INSERT INTO accounts_user (
    username, email, first_name, last_name, user_type, 
    is_staff, is_superuser, is_active, is_email_verified,
    password
) VALUES (
    'admin', 'admin@salonbook.com', 'Admin', 'User', 'admin',
    TRUE, TRUE, TRUE, TRUE,
    'pbkdf2_sha256$600000$placeholder$hash' -- Replace with actual hashed password
);

-- ============================================
-- END OF SCHEMA
-- ============================================

-- Notes for Supabase Migration:
-- 1. Run this script in your Supabase SQL Editor
-- 2. Update the admin user password after running the script
-- 3. Configure Row Level Security (RLS) policies based on your requirements
-- 4. Set up Supabase Storage buckets for media files:
--    - profiles (for profile pictures)
--    - salon_logos
--    - salon_covers
--    - service_images
--    - chat_images
-- 5. Update your Django settings.py to use PostgreSQL with Supabase connection string
-- 6. Run Django migrations to sync any additional Django-specific tables
