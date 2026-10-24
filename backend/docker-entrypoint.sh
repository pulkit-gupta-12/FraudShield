#!/bin/sh
set -e

echo "Waiting for database..."
if [ "$DATABASE_URL" ]; then
    python << 'END'
import time
import os
import sys
import psycopg2

db_url = os.environ.get('DATABASE_URL', '')
if 'postgres' in db_url:
    for i in range(30):
        try:
            conn = psycopg2.connect(db_url)
            conn.close()
            print("PostgreSQL connection established successfully.")
            break
        except Exception as e:
            print(f"Waiting for postgres ({i+1}/30)... {e}")
            time.sleep(1)
    else:
        print("Timed out waiting for PostgreSQL.")
        sys.exit(1)
END
fi

echo "Running migrations..."
python manage.py migrate --noinput

echo "Checking if database needs seeding..."
python -c "
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.accounts.models import User
if not User.objects.filter(role='admin').exists():
    print('Database is empty of admin users. Seeding required.')
    sys.exit(10)
else:
    print('Database is already seeded.')
    sys.exit(0)
" || SEED_NEEDED=$?

if [ "$SEED_NEEDED" = "10" ]; then
    echo "Creating demo users..."
    python manage.py create_demo_users
    echo "Seeding initial dataset..."
    python manage.py seed_data
fi

echo "Starting application server..."
exec "$@"
