import os
import sys
from pathlib import Path

# Setup Django environment
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

import numpy as np
import pandas as pd
from apps.fraud.models import ModelConfig
from apps.ml.ml_service import band, ml_service, score


def main():
    # 1. Read threshold and review_floor from database
    config = ModelConfig.objects.first()
    if not config:
        print("ERROR: ModelConfig not found in database. Run python manage.py seed_data first.")
        sys.exit(1)

    threshold = float(config.threshold)
    review_floor = float(config.review_floor)

    # 2. Load ml/data/test_sample.csv
    ml_dir = backend_dir.parent / 'ml'
    csv_path = ml_dir / 'data' / 'test_sample.csv'
    if not csv_path.exists():
        print(f"ERROR: test_sample.csv not found at {csv_path}")
        sys.exit(1)

    df = pd.read_csv(csv_path)

    # 3. Score every row through ml_service exactly as API will (raw -> scaler -> model)
    scores = score(df)
    bands = band(scores, threshold=threshold, review_floor=review_floor)

    # 4. Metrics
    y_true = df['Class'].to_numpy()
    total_rows = len(df)
    total_frauds = int(np.sum(y_true == 1))
    total_legit = int(np.sum(y_true == 0))

    # High band indicates fraud caught at decision threshold
    frauds_caught = int(np.sum((y_true == 1) & (bands == 'high')))
    missed_frauds = int(np.sum((y_true == 1) & (bands != 'high')))
    false_alarms = int(np.sum((y_true == 0) & (bands == 'high')))

    safe_count = int(np.sum(bands == 'safe'))
    review_count = int(np.sum(bands == 'review'))
    high_count = int(np.sum(bands == 'high'))

    print("==================================================")
    print("           MODEL VERIFICATION SELF-TEST           ")
    print("==================================================")
    print(f"Database Threshold    : {threshold}")
    print(f"Database Review Floor : {review_floor}")
    print(f"Model Version         : {config.version}")
    print(f"Number of rows        : {total_rows}")
    print(f"Frauds caught         : {frauds_caught}")
    print(f"Missed frauds         : {missed_frauds}")
    print(f"False alarms among the normal rows : {false_alarms}")
    print(f"Rows in safe band     : {safe_count}")
    print(f"Rows in review band   : {review_count}")
    print(f"Rows in high band     : {high_count}")
    print("==================================================")
    print("Self-test OK")


if __name__ == '__main__':
    main()
