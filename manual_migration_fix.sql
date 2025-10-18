-- Manual migration fix - Run this in Supabase SQL Editor
-- This tells Django that all migrations have already been applied

-- First, make sure django_migrations table exists
CREATE TABLE IF NOT EXISTS django_migrations (
    id BIGSERIAL PRIMARY KEY,
    app VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    applied TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Clear any existing migration records (fresh start)
TRUNCATE django_migrations;

-- Insert migration records for contenttypes
INSERT INTO django_migrations (app, name, applied) VALUES
('contenttypes', '0001_initial', NOW()),
('contenttypes', '0002_remove_content_type_name', NOW());

-- Insert migration records for auth
INSERT INTO django_migrations (app, name, applied) VALUES
('auth', '0001_initial', NOW()),
('auth', '0002_alter_permission_name_max_length', NOW()),
('auth', '0003_alter_user_email_max_length', NOW()),
('auth', '0004_alter_user_username_opts', NOW()),
('auth', '0005_alter_user_last_login_null', NOW()),
('auth', '0006_require_contenttypes_0002', NOW()),
('auth', '0007_alter_validators_add_error_messages', NOW()),
('auth', '0008_alter_user_username_max_length', NOW()),
('auth', '0009_alter_user_last_name_max_length', NOW()),
('auth', '0010_alter_group_name_max_length', NOW()),
('auth', '0011_update_proxy_permissions', NOW()),
('auth', '0012_alter_user_first_name_max_length', NOW());

-- Insert migration records for accounts (your custom user model)
INSERT INTO django_migrations (app, name, applied) VALUES
('accounts', '0001_initial', NOW());

-- Insert migration records for salons
INSERT INTO django_migrations (app, name, applied) VALUES
('salons', '0001_initial', NOW());

-- Insert migration records for bookings
INSERT INTO django_migrations (app, name, applied) VALUES
('bookings', '0001_initial', NOW());

-- Insert migration records for notifications
INSERT INTO django_migrations (app, name, applied) VALUES
('notifications', '0001_initial', NOW());

-- Insert migration records for admin
INSERT INTO django_migrations (app, name, applied) VALUES
('admin', '0001_initial', NOW()),
('admin', '0002_logentry_remove_auto_add', NOW()),
('admin', '0003_logentry_add_action_flag_choices', NOW());

-- Insert migration records for sessions
INSERT INTO django_migrations (app, name, applied) VALUES
('sessions', '0001_initial', NOW());

-- Verify migrations were inserted
SELECT app, COUNT(*) as migration_count 
FROM django_migrations 
GROUP BY app 
ORDER BY app;
