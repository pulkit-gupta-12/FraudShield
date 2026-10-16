import random
import uuid
from pathlib import Path
from typing import Optional

import pandas as pd
from django.conf import settings
from django.utils import timezone

from apps.fraud.models import Card, Merchant, Transaction
from apps.ml.ml_service import FEATURES, process_transaction

_SAMPLE_DF: Optional[pd.DataFrame] = None


def get_sample_df() -> pd.DataFrame:
    global _SAMPLE_DF
    if _SAMPLE_DF is None:
        ml_dir = Path(getattr(settings, 'ML_DIR', Path(__file__).resolve().parent.parent.parent.parent / 'ml'))
        sample_path = ml_dir / 'data' / 'test_sample.csv'
        if not sample_path.exists():
            raise FileNotFoundError(f"test_sample.csv not found at {sample_path}")
        _SAMPLE_DF = pd.read_csv(sample_path)
    return _SAMPLE_DF


def create_simulated_transaction() -> Transaction:
    """
    Creates one new live transaction from a random CSV row, random card and merchant,
    timestamps it now, and scores it through process_transaction().
    Shared between run_simulator and /api/simulator/tick/.
    """
    df = get_sample_df()
    random_idx = random.randint(0, len(df) - 1)
    row = df.iloc[random_idx]

    # Select random active card and merchant (skip blocked cards)
    card = Card.objects.filter(status='active').order_by('?').first()
    merchant = Merchant.objects.order_by('?').first()

    merchant_name = merchant.name if merchant else 'Reliance Digital'
    merchant_category = merchant.category if merchant else 'Electronics'
    city = merchant.city if merchant else 'Mumbai'

    raw_amount = float(row['Amount'])
    amount_inr = round(raw_amount * 90.0, 2)
    if amount_inr <= 0:
        amount_inr = round(random.uniform(150.0, 5000.0), 2)

    public_id = f"TXN-SIM-{uuid.uuid4().hex[:8].upper()}"

    model_inputs = {feat: float(row[feat]) for feat in FEATURES}
    class_val = int(row['Class']) if 'Class' in row else 0
    true_label = 'FRAUD' if class_val == 1 else 'LEGIT'

    txn = Transaction(
        public_id=public_id,
        card=card,
        merchant=merchant,
        merchant_name=merchant_name,
        merchant_category=merchant_category,
        amount=raw_amount,
        amount_inr=amount_inr,
        city=city,
        timestamp=timezone.now(),
        true_label=true_label,
        model_inputs=model_inputs,
        source='simulator',
    )

    # Score, assign factors, status, create alerts/cases/notifications if review or high
    processed_txn = process_transaction(txn, save=True)
    return processed_txn
