import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

import pandas as pd
from apps.fraud.models import PatternProfile
from apps.ml.feature_builder import build_features
from apps.ml.ml_service import score

pat = PatternProfile.objects.filter(code='P09').first() or PatternProfile.objects.first()
f_low = build_features(amount_inr=500.0, pattern=pat)
f_high = build_features(amount_inr=80000.0, pattern=pat)

s_low = float(score(pd.DataFrame([f_low]))[0])
s_high = float(score(pd.DataFrame([f_high]))[0])

print(f"Pattern: {pat.code} - {pat.label}")
print(f"At Rs 500: Raw Amount = {f_low['Amount']:.2f}, Score = {s_low:.4f}")
print(f"At Rs 80,000: Raw Amount = {f_high['Amount']:.2f}, Score = {s_high:.4f}")
