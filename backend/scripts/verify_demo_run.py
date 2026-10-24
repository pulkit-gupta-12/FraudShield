import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from datetime import datetime
from apps.accounts.models import User
from apps.fraud.models import Card, Merchant, PatternProfile, Transaction
from apps.ml.feature_builder import build_features
from apps.ml.ml_service import ml_service
from rest_framework.test import APIClient

print("--- 1. DATABASE STATE CHECK ---")
print(f"Transactions count: {Transaction.objects.count()}")
print(f"PatternProfiles count: {PatternProfile.objects.count()}")
print(f"Merchants count: {Merchant.objects.count()}")
print(f"Cards count: {Card.objects.count()}")

admin = User.objects.get(email='admin@fraudshield.io')
card = Card.objects.filter(owner__role='customer', status='active').first()
merchant = Merchant.objects.first()
pattern = PatternProfile.objects.get(code='P09')

client = APIClient()
client.force_authenticate(user=admin)

print("\n--- 2. STATS ON EMPTY DATABASE (ZERO TRANSACTIONS) ---")
for ep in ['overview', 'timeseries', 'by-hour', 'by-category', 'risk-distribution', 'analyst', 'merchant', 'customer']:
    res = client.get(f'/api/stats/{ep}/')
    status_str = "OK" if res.status_code == 200 else f"FAIL ({res.status_code})"
    print(f"  GET /api/stats/{ep}/ -> {status_str}")

print("\n--- 3. SAME PATTERN AT RS 500 VS RS 80,000 ---")
# Submit at Rs 500
resp_500 = client.post('/api/transactions/submit/', {
    'cardId': card.id,
    'merchantId': merchant.id,
    'amount': 500.0,
    'city': 'Mumbai',
    'occurredAt': '2026-10-25T14:30:00Z',
    'patternId': pattern.id,
    'note': 'Rs 500 test'
}, format='json')

# Submit at Rs 80,000
resp_80k = client.post('/api/transactions/submit/', {
    'cardId': card.id,
    'merchantId': merchant.id,
    'amount': 80000.0,
    'city': 'Mumbai',
    'occurredAt': '2026-10-25T14:30:00Z',
    'patternId': pattern.id,
    'note': 'Rs 80,000 test'
}, format='json')

d_500 = resp_500.data
d_80k = resp_80k.data

print(f"Pattern: {pattern.code} - {pattern.label}")
print(f"  Submission 1: Amount = Rs. 500.00")
print(f"    Risk Score: {d_500['riskScore']:.4f}")
print(f"    Band:       {d_500['band']}")
print(f"    Decision:   {d_500['decision']}")
print(f"    Reasons:    {d_500['reasons']}")
print(f"\n  Submission 2: Amount = Rs. 80,000.00")
print(f"    Risk Score: {d_80k['riskScore']:.4f}")
print(f"    Band:       {d_80k['band']}")
print(f"    Decision:   {d_80k['decision']}")
print(f"    Reasons:    {d_80k['reasons']}")
