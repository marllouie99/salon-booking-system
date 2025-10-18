"""
Initialize Django with Supabase database
This script helps set up Django's system tables in Supabase
"""

import os
import django
import psycopg2
from decouple import config

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'salon_booking.settings')
django.setup()

from django.core.management import call_command
from django.db import connection

def check_connection():
    """Test database connection"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT version();")
            version = cursor.fetchone()[0]
            print(f"✅ Connected to PostgreSQL")
            print(f"   Version: {version[:50]}...")
            return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

def create_missing_tables():
    """Create missing Django auth tables"""
    print("\n📋 Creating missing Django tables...")
    
    sql_commands = [
        # Auth Permission
        """
        CREATE TABLE IF NOT EXISTS auth_permission (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            content_type_id INTEGER NOT NULL REFERENCES django_content_type(id) ON DELETE CASCADE,
            codename VARCHAR(100) NOT NULL,
            UNIQUE(content_type_id, codename)
        );
        """,
        # Auth Group
        """
        CREATE TABLE IF NOT EXISTS auth_group (
            id SERIAL PRIMARY KEY,
            name VARCHAR(150) UNIQUE NOT NULL
        );
        """,
        # Auth Group Permissions
        """
        CREATE TABLE IF NOT EXISTS auth_group_permissions (
            id BIGSERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES auth_group(id) ON DELETE CASCADE,
            permission_id INTEGER NOT NULL REFERENCES auth_permission(id) ON DELETE CASCADE,
            UNIQUE(group_id, permission_id)
        );
        """,
        # User Groups
        """
        CREATE TABLE IF NOT EXISTS accounts_user_groups (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
            group_id INTEGER NOT NULL REFERENCES auth_group(id) ON DELETE CASCADE,
            UNIQUE(user_id, group_id)
        );
        """,
        # User Permissions
        """
        CREATE TABLE IF NOT EXISTS accounts_user_user_permissions (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE,
            permission_id INTEGER NOT NULL REFERENCES auth_permission(id) ON DELETE CASCADE,
            UNIQUE(user_id, permission_id)
        );
        """,
    ]
    
    try:
        with connection.cursor() as cursor:
            for sql in sql_commands:
                cursor.execute(sql)
        print("✅ Missing tables created successfully")
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

def run_migrations():
    """Run Django migrations"""
    print("\n🔄 Running Django migrations...")
    try:
        call_command('migrate', '--fake-initial', verbosity=2)
        print("✅ Migrations completed successfully")
        return True
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

def main():
    print("=" * 60)
    print("🚀 Initializing Django with Supabase")
    print("=" * 60)
    
    # Step 1: Check connection
    if not check_connection():
        print("\n❌ Cannot proceed without database connection")
        print("   Please check your .env file credentials")
        return
    
    # Step 2: Create missing tables
    if not create_missing_tables():
        print("\n⚠️  Some tables may already exist, continuing...")
    
    # Step 3: Run migrations
    if run_migrations():
        print("\n" + "=" * 60)
        print("✅ SUCCESS! Django is now connected to Supabase")
        print("=" * 60)
        print("\n📝 Next steps:")
        print("   1. Create superuser: python manage.py createsuperuser")
        print("   2. Run server: python manage.py runserver")
    else:
        print("\n" + "=" * 60)
        print("⚠️  Migration had issues")
        print("=" * 60)
        print("\n💡 Try running manually:")
        print("   python manage.py migrate --run-syncdb")

if __name__ == '__main__':
    main()
