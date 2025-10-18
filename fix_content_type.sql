-- Fix django_content_type table to match Django's requirements
-- Run this in Supabase SQL Editor

-- Drop the existing table if it has issues
DROP TABLE IF EXISTS django_content_type CASCADE;

-- Recreate with correct schema
CREATE TABLE django_content_type (
    id SERIAL PRIMARY KEY,
    app_label VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    UNIQUE(app_label, model)
);

-- Create index
CREATE INDEX idx_django_content_type_app_label ON django_content_type(app_label);

-- Now recreate auth_permission table (it depends on content_type)
DROP TABLE IF EXISTS auth_permission CASCADE;

CREATE TABLE auth_permission (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content_type_id INTEGER NOT NULL REFERENCES django_content_type(id) ON DELETE CASCADE,
    codename VARCHAR(100) NOT NULL,
    UNIQUE(content_type_id, codename)
);

CREATE INDEX idx_auth_permission_content_type ON auth_permission(content_type_id);

-- Recreate auth_group
DROP TABLE IF EXISTS auth_group CASCADE;

CREATE TABLE auth_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL
);

-- Recreate auth_group_permissions
DROP TABLE IF EXISTS auth_group_permissions CASCADE;

CREATE TABLE auth_group_permissions (
    id BIGSERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES auth_group(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id) ON DELETE CASCADE,
    UNIQUE(group_id, permission_id)
);

CREATE INDEX idx_auth_group_permissions_group ON auth_group_permissions(group_id);
CREATE INDEX idx_auth_group_permissions_permission ON auth_group_permissions(permission_id);

-- Recreate accounts_user_groups
DROP TABLE IF EXISTS accounts_user_groups CASCADE;

CREATE TABLE accounts_user_groups (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES auth_group(id) ON DELETE CASCADE,
    UNIQUE(user_id, group_id)
);

CREATE INDEX idx_accounts_user_groups_user ON accounts_user_groups(user_id);
CREATE INDEX idx_accounts_user_groups_group ON accounts_user_groups(group_id);

-- Recreate accounts_user_user_permissions
DROP TABLE IF EXISTS accounts_user_user_permissions CASCADE;

CREATE TABLE accounts_user_user_permissions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id) ON DELETE CASCADE,
    UNIQUE(user_id, permission_id)
);

CREATE INDEX idx_accounts_user_permissions_user ON accounts_user_user_permissions(user_id);
CREATE INDEX idx_accounts_user_permissions_permission ON accounts_user_user_permissions(permission_id);
