-- Add remaining migration records
-- Run this in Supabase SQL Editor

-- Add missing accounts migrations
INSERT INTO django_migrations (app, name, applied) VALUES
('accounts', '0002_user_email_verification_code_and_more', NOW()),
('accounts', '0003_user_password_reset_code_user_password_reset_expires', NOW());

-- Add missing salons migrations
INSERT INTO django_migrations (app, name, applied) VALUES
('salons', '0002_service', NOW()),
('salons', '0003_review', NOW()),
('salons', '0004_serviceimage', NOW());

-- Add missing bookings migrations
INSERT INTO django_migrations (app, name, applied) VALUES
('bookings', '0002_alter_booking_options_remove_booking_notes_and_more', NOW()),
('bookings', '0003_booking_notes', NOW()),
('bookings', '0004_transaction', NOW()),
('bookings', '0005_chat_message', NOW()),
('bookings', '0006_message_image_alter_message_message_type', NOW()),
('bookings', '0007_alter_message_message_type', NOW()),
('bookings', '0008_booking_payment_method_and_more', NOW()),
('bookings', '0009_booking_google_calendar_event_id_and_more', NOW());

-- Verify all migrations
SELECT app, name FROM django_migrations ORDER BY app, name;
