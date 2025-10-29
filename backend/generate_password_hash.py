#!/usr/bin/env python
"""
Generate password hash for Django user
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'salon_booking.settings')
django.setup()

from django.contrib.auth.hashers import make_password

password = 'ramdar143'
hashed = make_password(password)

print("=" * 60)
print("Password Hash Generated")
print("=" * 60)
print(f"Plain Password: {password}")
print(f"Hashed Password:\n{hashed}")
print("=" * 60)
print("\nCopy the hashed password above and update the 'password' field")
print("in the Railway database for user: ramdar143")
