import json
from pathlib import Path
import numpy as np
import pandas as pd
import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from apps.fraud.models import Alert, Card, Case, CaseEvent, Merchant, ModelConfig, Notification, Transaction
from apps.fraud.simulator import get_sample_df
from apps.ml.ml_service import FEATURES, band, explain, ml_service, process_transaction, score, status_for

User = get_user_model()


@pytest.mark.django_db
class TestBandBoundaries:
    """Tests for band boundaries reading threshold and review_floor dynamically from ModelConfig."""

    def _get_config(self):
        cfg = ModelConfig.objects.first()
        if cfg:
            return cfg
        ml_dir = Path(__file__).resolve().parent.parent.parent / 'ml'
        threshold_val = float((ml_dir / 'threshold.txt').read_text().strip())
        with open(ml_dir / 'model_report.json') as f:
            rep = json.load(f)
        return ModelConfig.objects.create(
            version=rep.get('version', 'v1.0'),
            threshold=threshold_val,
            review_floor=float(rep['review_floor']),
        )

    def test_functional_band_boundaries(self):
        cfg = self._get_config()
        t = float(cfg.threshold)
        rf = float(cfg.review_floor)

        assert band(rf - 0.001) == 'safe'
        assert band(rf) == 'review'
        assert band(t - 0.001) == 'review'
        assert band(t) == 'high'

    def test_vectorised_band_boundaries(self):
        cfg = self._get_config()
        t = float(cfg.threshold)
        rf = float(cfg.review_floor)

        scores = np.array([rf - 0.001, rf, t - 0.001, t])
        bands = band(scores)
        assert list(bands) == ['safe', 'review', 'review', 'high']

    def test_model_method_band_boundaries(self):
        cfg = self._get_config()
        t = float(cfg.threshold)
        rf = float(cfg.review_floor)

        t1 = Transaction(risk_score=rf - 0.001)
        t2 = Transaction(risk_score=rf)
        t3 = Transaction(risk_score=t - 0.001)
        t4 = Transaction(risk_score=t)

        assert t1.band() == 'safe'
        assert t2.band() == 'review'
        assert t3.band() == 'review'
        assert t4.band() == 'high'

        # Status for bands
        assert status_for('safe') == 'approved'
        assert status_for('review') == 'flagged'
        assert status_for('high') == 'blocked'

    def test_to_display_dict_camel_case(self):
        user = User.objects.create(email="test.cardholder@example.com", name="Aarav Sharma", role="customer")
        card = Card.objects.create(
            owner=user,
            card_number="4532 •••• •••• 8821",
            last4="8821",
            brand="Visa",
            card_type="Visa Platinum",
        )
        merchant = Merchant.objects.create(name="Reliance Digital", category="Electronics", city="Mumbai")
        txn = Transaction.objects.create(
            public_id="TXN-999999",
            card=card,
            merchant=merchant,
            merchant_name=merchant.name,
            merchant_category=merchant.category,
            amount=157.8,
            amount_inr=14202.0,
            city="Mumbai",
            risk_score=0.045,
            status="approved",
            true_label="LEGIT",
            factors=[{"name": "Amount (unusually high or low)", "impact": -0.15, "feature": "Amount"}],
            model_inputs={"Time": 1240.0, "Amount": 157.8},
        )

        display = txn.to_display_dict()
        assert display['id'] == "TXN-999999"
        assert display['cardLast4'] == "8821"
        assert display['cardholder'] == "Aarav Sharma"
        assert display['merchant'] == "Reliance Digital"
        assert display['category'] == "Electronics"
        assert display['amountINR'] == 14202.0
        assert display['riskScore'] == 0.045
        assert display['band'] == "safe"
        assert display['status'] == "approved"


@pytest.mark.django_db
class TestRealMLScoring:
    """Tests for single vs batch scoring equivalence, SHAP explainability, and input validation."""

    def test_single_row_equals_batch_scoring(self):
        df = get_sample_df().head(10)

        # Batch scoring
        batch_scores = score(df)
        assert len(batch_scores) == 10

        # Single row scoring for each row in batch
        for i in range(5):
            single_row_df = df.iloc[[i]]
            single_score = score(single_row_df)[0]
            assert np.isclose(single_score, batch_scores[i], atol=1e-6), (
                f"Row {i} single score ({single_score}) differs from batch ({batch_scores[i]})"
            )

    def test_explain_factors_structure(self):
        df = get_sample_df().head(3)
        explanations = explain(df)

        assert len(explanations) == 3
        for row_factors in explanations:
            assert len(row_factors) == 5
            for factor in row_factors:
                assert 'name' in factor
                assert 'impact' in factor
                assert 'feature' in factor
                assert isinstance(factor['impact'], float)
                assert factor['feature'] in FEATURES

    def test_missing_column_raises_error(self):
        df = get_sample_df().head(2).copy()
        df = df.drop(columns=['V14'])
        with pytest.raises(ValueError, match="Missing required feature columns"):
            score(df)


@pytest.mark.django_db
class TestProcessTransaction:
    """Tests that process_transaction creates Alert, Case, and Notifications only for review and high."""

    def setup_method(self):
        self.analyst1 = User.objects.create(email="analyst.test1@fraudshield.io", role="analyst", is_active=True)
        self.analyst2 = User.objects.create(email="analyst.test2@fraudshield.io", role="analyst", is_active=True)
        self.customer = User.objects.create(email="cust.test@fraudshield.io", name="Priya Patel", role="customer")
        self.card = Card.objects.create(owner=self.customer, last4="1234", brand="Visa")
        self.merchant = Merchant.objects.create(name="Croma", category="Electronics", city="Bengaluru")
        self.sample_df = get_sample_df()

    def test_safe_transaction_creates_no_alert_case_or_notification(self):
        # Row 0 in test_sample is safe (prob ~ 3.5e-07)
        row = self.sample_df.iloc[0]
        inputs = {col: float(row[col]) for col in FEATURES}

        txn = Transaction.objects.create(
            public_id="TXN-SAFE-001",
            card=self.card,
            merchant=self.merchant,
            amount=float(row['Amount']),
            amount_inr=float(row['Amount']) * 90.0,
            model_inputs=inputs,
        )

        initial_alerts_count = Alert.objects.count()
        initial_cases_count = Case.objects.count()
        initial_notifs_count = Notification.objects.count()

        processed = process_transaction(txn)
        cfg = ml_service.get_config()

        assert processed.risk_score < cfg['review_floor']
        assert processed.band() == 'safe'
        assert processed.status == 'approved'
        assert Alert.objects.count() == initial_alerts_count
        assert Case.objects.count() == initial_cases_count
        assert Notification.objects.count() == initial_notifs_count

    def test_high_risk_transaction_creates_alert_case_and_notifications(self):
        # Find a row with Class == 1 (fraud) which scores >= threshold
        cfg = ml_service.get_config()
        fraud_rows = self.sample_df[self.sample_df['Class'] == 1]
        fraud_row = fraud_rows.iloc[0]
        inputs = {col: float(fraud_row[col]) for col in FEATURES}

        txn = Transaction.objects.create(
            public_id="TXN-FRAUD-001",
            card=self.card,
            merchant=self.merchant,
            amount=float(fraud_row['Amount']),
            amount_inr=float(fraud_row['Amount']) * 90.0,
            model_inputs=inputs,
        )

        initial_notifs_count = Notification.objects.count()

        processed = process_transaction(txn)

        assert processed.risk_score >= cfg['review_floor']
        expected_band = processed.band()
        assert expected_band in ('review', 'high')
        assert processed.status in ('flagged', 'blocked')

        # Verify Alert created
        alert = Alert.objects.get(transaction=processed)
        assert alert.status == 'new'
        if expected_band == 'high':
            assert alert.severity == 'high'
        else:
            assert alert.severity == 'medium'

        # Verify Case created with timeline event
        case = Case.objects.get(transaction=processed)
        assert case.alert == alert
        assert case.status == 'Open'
        assert CaseEvent.objects.filter(case=case).count() >= 1

        # Verify Notifications: 1 to cardholder + 1 to each analyst
        assert Notification.objects.filter(user=self.customer, type='alert').exists()
        for analyst in [self.analyst1, self.analyst2]:
            assert Notification.objects.filter(user=analyst, type='alert').exists()
