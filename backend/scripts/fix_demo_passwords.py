import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User

demo_emails = [
    'admin@fraudshield.io', 'admin@fraudshield.com',
    'analyst@fraudshield.io', 'analyst@fraudshield.com',
    'customer@fraudshield.io', 'customer@fraudshield.com',
    'merchant@fraudshield.io', 'merchant@fraudshield.com',
]

for email in demo_emails:
    users = User.objects.filter(email=email)
    for u in users:
        u.set_password('password123')
        u.is_active = True
        u.status = 'active'
        u.save()
        print(f"Set password for {u.email} to password123")

print("Done updating demo accounts!")
