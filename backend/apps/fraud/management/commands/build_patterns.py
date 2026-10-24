import json
from pathlib import Path
import pandas as pd
import numpy as np
from django.conf import settings
from django.core.management.base import BaseCommand
from apps.fraud.models import PatternProfile, ModelConfig
from apps.ml.ml_service import ml_service, score, FEATURES

LABELS = [
    # 8 normal low
    "Everyday Grocery Store",
    "Morning Coffee & Metro",
    "Monthly Utility Bill",
    "Streaming Entertainment",
    "Local Pharmacy Health",
    "Weekend Family Dining",
    "Online Bookstore",
    "Department Store Apparel",
    # 4 normal mid
    "Late Night Electronics",
    "Luxury Watch Boutique",
    "High-End Designer Outlet",
    "Rapid Domestic Flight Booking",
    # 5 fraud high
    "Midnight Overseas Wire Transfer",
    "Rapid High-Ticket Gift Cards",
    "Unusual Out-of-State Jewelry",
    "International Electronics Spree",
    "High Velocity Automated Cash Out",
    # 2 fraud medium
    "Multi-Terminal Consecutive Swipes",
    "Deviant Transaction Velocity Spike",
    # 1 fraud low (real model miss)
    "Stealth Micro-Authorization",
]

class Command(BaseCommand):
    help = "Builds 20 representative PatternProfile rows from ml/data/test_sample.csv"

    def handle(self, *args, **options):
        self.stdout.write("Scoring test_sample.csv to select 20 pattern profiles...")
        ml_dir = Path(getattr(settings, 'ML_DIR', Path(__file__).resolve().parent.parent.parent.parent.parent / 'ml'))
        csv_path = ml_dir / 'data' / 'test_sample.csv'

        if not csv_path.exists():
            self.stderr.write(f"Sample CSV not found at {csv_path}")
            return

        df = pd.read_csv(csv_path)
        scores = score(df)
        df['score'] = scores

        normal = df[df['Class'] == 0].copy()
        fraud = df[df['Class'] == 1].copy()

        cfg = ml_service.get_config()
        t_val = cfg['threshold']
        rf_val = cfg['review_floor']

        # 1. 8 normal rows with low scores
        low_normal = normal.sort_values('score').head(8)

        # 2. 4 normal rows with mid scores (highest normal scores closest to review floor)
        mid_normal = normal.sort_values('score', ascending=False).head(4)

        # 3. 5 fraud rows with high scores (>= threshold)
        high_fraud = fraud[fraud['score'] >= t_val].sort_values('score', ascending=False).head(5)

        # 4. 2 fraud rows with medium scores (under threshold, top medium)
        med_fraud = fraud[fraud['score'] < t_val].sort_values('score', ascending=False).head(2)

        # 5. 1 fraud row that the model scores LOW (real miss)
        low_fraud = fraud[fraud['score'] < t_val].sort_values('score', ascending=True).head(1)

        selected_groups = [
            low_normal,
            mid_normal,
            high_fraud,
            med_fraud,
            low_fraud,
        ]

        selected_rows = []
        for g in selected_groups:
            for _, r in g.iterrows():
                selected_rows.append(r)

        if len(selected_rows) != 20:
            self.stdout.write(self.style.WARNING(f"Expected 20 rows, got {len(selected_rows)}. Adjusting selection..."))
            # Fallback if specific slices differed
            remaining = 20 - len(selected_rows)
            if remaining > 0:
                extras = normal[normal['score'] < 0.1].head(remaining)
                for _, r in extras.iterrows():
                    selected_rows.append(r)

        PatternProfile.objects.all().delete()

        created_count = 0
        for idx, row in enumerate(selected_rows[:20]):
            code = f"P{idx+1:02d}"
            label = LABELS[idx] if idx < len(LABELS) else f"Spending Pattern {idx+1:02d}"
            v_vals = [float(row[f'V{i}']) for i in range(1, 29)]
            
            raw_seconds = float(row['Time'])
            seconds_in_day = int(raw_seconds % 86400)
            hours = seconds_in_day // 3600
            mins = (seconds_in_day % 3600) // 60
            typical_time = f"{hours:02d}:{mins:02d}"
            
            amount_inr = round(float(row['Amount']) * 90.0, 2)
            if amount_inr < 50.0:
                amount_inr = 450.0  # reasonable display minimum
                
            true_label = int(row['Class'])
            base_score = round(float(row['score']), 4)

            PatternProfile.objects.create(
                code=code,
                label=label,
                v_values=v_vals,
                typical_amount=amount_inr,
                typical_time=typical_time,
                true_label=true_label,
                base_score=base_score,
            )
            created_count += 1
            self.stdout.write(f"  [{code}] {label} (Typical: Rs. {amount_inr:,.2f} at {typical_time}, Class={true_label}, Score={base_score:.4f})")

        self.stdout.write(self.style.SUCCESS(f"Successfully created {created_count} demo PatternProfiles."))
