-- Fix Django Content Types Table
-- Run this in Supabase SQL Editor if migrations fail

-- Create auth_permission table
CREATE TABLE IF NOT EXISTS auth_permission (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content_type_id INTEGER NOT NULL REFERENCES django_content_type(id) ON DELETE CASCADE,
    codename VARCHAR(100) NOT NULL,
    UNIQUE(content_type_id, codename)
);

-- Create auth_group table
CREATE TABLE IF NOT EXISTS auth_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL
);

-- Create auth_group_permissions table
CREATE TABLE IF NOT EXISTS auth_group_permissions (
    id BIGSERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES auth_group(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id) ON DELETE CASCADE,
    UNIQUE(group_id, permission_id)
);

-- Create accounts_user_groups table
CREATE TABLE IF NOT EXISTS accounts_user_groups (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES auth_group(id) ON DELETE CASCADE,
    UNIQUE(user_id, group_id)
);

-- Create accounts_user_user_permissions table
CREATE TABLE IF NOT EXISTS accounts_user_user_permissions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id) ON DELETE CASCADE,
    UNIQUE(user_id, permission_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auth_permission_content_type ON auth_permission(content_type_id);
CREATE INDEX IF NOT EXISTS idx_auth_group_permissions_group ON auth_group_permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_auth_group_permissions_permission ON auth_group_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_groups_user ON accounts_user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_groups_group ON accounts_user_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_permissions_user ON accounts_user_user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_permissions_permission ON accounts_user_user_permissions(permission_id);
