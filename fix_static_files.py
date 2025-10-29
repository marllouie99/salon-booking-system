"""
Script to add Django static template tags to all HTML files
"""
import os
import re

templates_dir = 'backend/templates'

# Files to process
html_files = []
for root, dirs, files in os.walk(templates_dir):
    for file in files:
        if file.endswith('.html'):
            html_files.append(os.path.join(root, file))

print(f"Found {len(html_files)} HTML files")

for filepath in html_files:
    print(f"Processing: {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if already has {% load static %}
    if '{% load static %}' in content:
        print("  - Already has load static tag")
        continue
    
    # Add {% load static %} at the top
    if content.startswith('<!DOCTYPE'):
        content = '{% load static %}\n' + content
    
    # Replace common static file references
    # CSS files
    content = re.sub(r'href="([^"]+\.css)"', r'href="{% static \'\1\' %}"', content)
    # JS files (not external URLs)
    content = re.sub(r'src="(?!https?://)([^"]+\.js)"', r'src="{% static \'\1\' %}"', content)
    # Images
    content = re.sub(r'src="(?!https?://)([^"]+\.(png|jpg|jpeg|gif|svg|webp))"', r'src="{% static \'\1\' %}"', content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"  - Updated!")

print("\nDone! All HTML files updated with Django static tags.")
