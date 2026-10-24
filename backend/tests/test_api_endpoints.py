import io
import json
import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

from apps.fraud.models import Card, Merchant, Transaction, Alert, Case, CaseEvent, ModelConfig, Notification
from apps.ml.ml_service import ml_service, process_transaction

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def setup_data(db):
    # Ensure ModelConfig exists
    cfg = ModelConfig.objects.first()
    if not cfg:
        cfg = ModelConfig.objects.create(
            version="v1.2.0-xgb",
            threshold=0.521,
            review_floor=0.5,
            scale_pos_weight=577.88,
        )

    # Users
    admin = User.objects.create_user(
        email="admin@test.com", password="Password123!", role="admin", name="Admin User", is_active=True
    )
    analyst = User.objects.create_user(
        email="analyst@test.com", password="Password123!", role="analyst", name="Analyst User", is_active=True
    )
    cust1 = User.objects.create_user(
        email="cust1@test.com", password="Password123!", role="customer", name="Customer One", is_active=True
    )
    cust2 = User.objects.create_user(
        email="cust2@test.com", password="Password123!", role="customer", name="Customer Two", is_active=True
    )
    merchant_user = User.objects.create_user(
        email="merchant@test.com", password="Password123!", role="merchant", name="Merchant User", is_active=True
    )

    merchant = Merchant.objects.create(name="Reliance Digital", category="Electronics", city="Mumbai")
    merchant_user.merchant = merchant
    merchant_user.save()

    # Cards
    card1 = Card.objects.create(
        owner=cust1, card_number="4532 •••• •••• 1111", last4="1111", brand="Visa", status="active"
    )
    card2 = Card.objects.create(
        owner=cust2, card_number="4532 •••• •••• 2222", last4="2222", brand="Mastercard", status="active"
    )

    # Transactions
    dummy_features = {"Time": 100.0, "Amount": 500.0}
    for i in range(1, 29):
        dummy_features[f"V{i}"] = 0.0

    txn1 = Transaction.objects.create(
        public_id="TXN-CUST1-001",
        card=card1,
        merchant=merchant,
        merchant_name=merchant.name,
        merchant_category=merchant.category,
        amount=500.0,
        amount_inr=45000.0,
        city="Mumbai",
        risk_score=0.10,
        scoring_ms=14.2,
        status="approved",
        true_label="LEGIT",
        model_inputs=dummy_features,
    )

    txn2 = Transaction.objects.create(
        public_id="TXN-CUST2-002",
        card=card2,
        merchant=merchant,
        merchant_name=merchant.name,
        merchant_category=merchant.category,
        amount=1200.0,
        amount_inr=108000.0,
        city="Mumbai",
        risk_score=0.85,
        scoring_ms=16.8,
        status="flagged",
        true_label="FRAUD",
        model_inputs=dummy_features,
    )

    # Alerts & Cases for txn2
    alert2 = Alert.objects.create(
        transaction=txn2,
        severity="high",
        status="new",
    )
    case2 = Case.objects.create(
        transaction=txn2,
        alert=alert2,
        status="Open",
        priority="P1",
    )

    return {
        'cfg': cfg,
        'admin': admin,
        'analyst': analyst,
        'cust1': cust1,
        'cust2': cust2,
        'merchant_user': merchant_user,
        'merchant': merchant,
        'card1': card1,
        'card2': card2,
        'txn1': txn1,
        'txn2': txn2,
        'alert2': alert2,
        'case2': case2,
        'dummy_features': dummy_features,
    }


# ─── 1. RBAC & Scoping Tests ───────────────────────────────────────────────────

@pytest.mark.django_db
def test_customer_cannot_see_other_customer_data(api_client, setup_data):
    """Customer cannot see another customer's transactions, alerts or cards (404)."""
    d = setup_data
    api_client.force_authenticate(user=d['cust1'])

    # Customer 1 accessing Customer 2's transaction -> 404
    res_txn = api_client.get(f"/api/transactions/{d['txn2'].public_id}/")
    assert res_txn.status_code == 404

    # Customer 1 accessing Customer 2's alert -> 404
    res_alert = api_client.get(f"/api/alerts/{d['alert2'].id}/")
    assert res_alert.status_code == 404

    # Customer 1 accessing Customer 2's card -> 404
    res_card = api_client.get(f"/api/cards/{d['card2'].id}/")
    assert res_card.status_code == 404

    # Customer 1 can see their own transaction and card
    res_own_txn = api_client.get(f"/api/transactions/{d['txn1'].public_id}/")
    assert res_own_txn.status_code == 200
    res_own_card = api_client.get(f"/api/cards/{d['card1'].id}/")
    assert res_own_card.status_code == 200


@pytest.mark.django_db
def test_merchant_cannot_open_cases(api_client, setup_data):
    """Merchant cannot open or view cases (403)."""
    d = setup_data
    api_client.force_authenticate(user=d['merchant_user'])

    # Merchant trying to access cases list -> 403
    res_list = api_client.get("/api/cases/")
    assert res_list.status_code == 403

    # Merchant trying to create a case -> 403
    res_post = api_client.post("/api/cases/", {"transactionId": d['txn1'].public_id})
    assert res_post.status_code == 403


@pytest.mark.django_db
def test_analyst_cannot_change_threshold(api_client, setup_data):
    """Analyst cannot change the threshold (403)."""
    d = setup_data
    api_client.force_authenticate(user=d['analyst'])

    res_put = api_client.put("/api/model/threshold/", {"threshold": 0.65})
    assert res_put.status_code == 403

    res_patch = api_client.patch("/api/model/thresholds/", {"fraud": 0.65, "suspicious": 0.45})
    assert res_patch.status_code == 403


# ─── 2. Filters & Ordering Tests ──────────────────────────────────────────────

@pytest.mark.django_db
def test_transaction_filters_and_ordering(api_client, setup_data):
    """Filters, camelCase ordering, rejection of unknown ordering, and since filter."""
    d = setup_data
    api_client.force_authenticate(user=d['admin'])

    # Filter by status
    res = api_client.get("/api/transactions/?status=approved")
    assert res.status_code == 200
    assert any(t['id'] == d['txn1'].public_id for t in res.data['results'])

    # CamelCase ordering: riskScore descending
    res_order = api_client.get("/api/transactions/?ordering=-riskScore")
    assert res_order.status_code == 200
    assert res_order.data['results'][0]['riskScore'] >= res_order.data['results'][-1]['riskScore']

    # Unknown ordering field rejected with 400
    res_unknown = api_client.get("/api/transactions/?ordering=invalidFieldName")
    assert res_unknown.status_code == 400

    # Since filter
    past_time = timezone.now().isoformat()
    # Transaction created before past_time shouldn't appear with since=now
    res_since = api_client.get(f"/api/transactions/?since={past_time}")
    assert res_since.status_code == 200
    assert res_since.data['count'] == 0


# ─── 3. What-If Numbers Tests ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_model_what_if_known_threshold(api_client, setup_data):
    """Tests the what-if simulation numbers for a known threshold using stored rows."""
    d = setup_data
    api_client.force_authenticate(user=d['admin'])

    # txn1: score 0.10, label LEGIT
    # txn2: score 0.85, label FRAUD
    # At threshold 0.50: txn2 flagged (1 flagged, 1 caught, 0 false alarms, precision 1.0, recall 1.0)
    res = api_client.get("/api/model/what-if/?threshold=0.50")
    assert res.status_code == 200
    data = res.data
    assert data['flagged'] == 1
    assert data['caught'] == 1
    assert data['falseAlarms'] == 0
    assert data['precision'] == 1.0
    assert data['recall'] == 1.0

    # At threshold 0.05: both flagged (2 flagged, 1 caught, 1 false alarm, precision 0.5, recall 1.0)
    res_low = api_client.get("/api/model/what-if/?threshold=0.05")
    assert res_low.status_code == 200
    data_low = res_low.data
    assert data_low['flagged'] == 2
    assert data_low['caught'] == 1
    assert data_low['falseAlarms'] == 1
    assert data_low['precision'] == 0.5
    assert data_low['recall'] == 1.0


# ─── 4. Case Actions & Customer Response Flow Tests ────────────────────────────

@pytest.mark.django_db
def test_case_action_fraud_blocks_card_and_notifies(api_client, setup_data):
    """Case action fraud: transaction confirmed_fraud, card blocked automatically, alert resolved, cardholder notified."""
    d = setup_data
    api_client.force_authenticate(user=d['analyst'])

    case_id = d['case2'].id
    card = d['card2']
    assert card.status == "active"

    res = api_client.post(f"/api/cases/{case_id}/action/", {
        "action": "fraud",
        "note": "Confirmed stolen card pattern.",
    })
    assert res.status_code == 200

    # Verify side effects
    d['txn2'].refresh_from_db()
    assert d['txn2'].status == "confirmed_fraud"

    card.refresh_from_db()
    assert card.status == "blocked"

    d['alert2'].refresh_from_db()
    assert d['alert2'].status == "resolved"

    # Notification sent to cardholder
    notif = Notification.objects.filter(user=d['cust2'], type="alert").first()
    assert notif is not None
    assert "blocked" in notif.body.lower()


@pytest.mark.django_db
def test_case_action_requires_note(api_client, setup_data):
    """Action without a note must return 400."""
    d = setup_data
    api_client.force_authenticate(user=d['analyst'])

    res = api_client.post(f"/api/cases/{d['case2'].id}/action/", {
        "action": "safe",
        # missing note
    })
    assert res.status_code == 400


@pytest.mark.django_db
def test_customer_response_flows(api_client, setup_data):
    """Customer answers not_me and confirmed_me flows."""
    d = setup_data

    # 1. Customer answers not_me
    api_client.force_authenticate(user=d['cust2'])
    res_not_me = api_client.patch(f"/api/alerts/{d['alert2'].id}/", {
        "customerResponse": "not_me",
    })
    assert res_not_me.status_code == 200

    d['alert2'].refresh_from_db()
    assert d['alert2'].status == "escalated"
    assert d['alert2'].customer_response == "not_me"

    d['case2'].refresh_from_db()
    assert d['case2'].status == "Escalated"

    # Analysts notified
    analyst_notif = Notification.objects.filter(user=d['analyst']).first()
    assert analyst_notif is not None

    # 2. Customer answers confirmed_me
    res_confirmed = api_client.patch(f"/api/alerts/{d['alert2'].id}/", {
        "customerResponse": "confirmed_me",
    })
    assert res_confirmed.status_code == 200

    d['alert2'].refresh_from_db()
    assert d['alert2'].status == "resolved"
    assert d['alert2'].customer_response == "confirmed_me"

    d['txn2'].refresh_from_db()
    assert d['txn2'].status == "confirmed_safe"

    d['case2'].refresh_from_db()
    assert d['case2'].outcome == "safe"


# ─── 5. Batch CSV Validation Tests ─────────────────────────────────────────────

@pytest.mark.django_db
def test_batch_csv_validation_errors(api_client, setup_data):
    """Test validation errors for batch CSV uploads."""
    d = setup_data
    api_client.force_authenticate(user=d['analyst'])

    # 1. Missing columns
    bad_csv = "Time,Amount\n0,100\n"
    file_bad = SimpleUploadedFile("test.csv", bad_csv.encode('utf-8'), content_type="text/csv")
    res1 = api_client.post("/api/predict/batch/", {"file": file_bad}, format="multipart")
    assert res1.status_code == 400

    # 2. Non-numeric values in features
    cols = ["Time"] + [f"V{i}" for i in range(1, 29)] + ["Amount"]
    header = ",".join(cols)
    row_corrupt = ["0"] + ["abc" if i == 1 else "0.1" for i in range(1, 29)] + ["100"]
    csv_corrupt = f"{header}\n{','.join(row_corrupt)}\n"
    file_corrupt = SimpleUploadedFile("corrupt.csv", csv_corrupt.encode('utf-8'), content_type="text/csv")
    res2 = api_client.post("/api/predict/batch/", {"file": file_corrupt}, format="multipart")
    assert res2.status_code == 400

    # 3. Valid batch CSV produces results & summary
    row_valid = ["0"] + ["0.0" for _ in range(28)] + ["150.0"]
    csv_valid = f"{header}\n{','.join(row_valid)}\n"
    file_valid = SimpleUploadedFile("valid.csv", csv_valid.encode('utf-8'), content_type="text/csv")
    res3 = api_client.post("/api/predict/batch/", {"file": file_valid}, format="multipart")
    assert res3.status_code == 200
    assert res3.data['processedCount'] == 1
    assert 'summary' in res3.data
    assert len(res3.data['results']) == 1


# ─── 6. Predict Samples & Live Simulator Tick Tests ────────────────────────────

@pytest.mark.django_db
def test_predict_samples_and_simulator_tick(api_client, setup_data):
    """Test GET /api/predict/samples/ and POST /api/simulator/tick/."""
    d = setup_data
    api_client.force_authenticate(user=d['analyst'])

    # Predict samples
    res_samples = api_client.get("/api/predict/samples/")
    assert res_samples.status_code == 200
    assert len(res_samples.data) == 200
    assert 'Class' not in res_samples.data[0]

    # Simulator tick creates a real transaction or returns 404 when DEMO_SIMULATOR is disabled
    res_tick = api_client.post("/api/simulator/tick/")
    if res_tick.status_code == 200:
        assert "publicId" in res_tick.data or "id" in res_tick.data
        assert res_tick.data["source"] == "simulator"
        assert res_tick.data["scoringMs"] >= 0.0
    else:
        assert res_tick.status_code == 404


# ─── 7. Statistics Endpoints Tests ─────────────────────────────────────────────

@pytest.mark.django_db
def test_stats_endpoints(api_client, setup_data):
    """Test /api/stats/ endpoints with DB aggregation."""
    d = setup_data
    api_client.force_authenticate(user=d['admin'])

    # Overview
    res_ov = api_client.get("/api/stats/overview/?range=30d")
    assert res_ov.status_code == 200
    assert "totalTransactions" in res_ov.data
    assert "fraudDetected" in res_ov.data
    assert "fraudRate" in res_ov.data
    assert "amountSaved" in res_ov.data
    assert "avgDetectionMs" in res_ov.data
    assert "trend" in res_ov.data

    # Timeseries
    res_ts = api_client.get("/api/stats/timeseries/?days=7")
    assert res_ts.status_code == 200
    assert len(res_ts.data) == 7

    # By Hour
    res_hr = api_client.get("/api/stats/by-hour/")
    assert res_hr.status_code == 200
    assert len(res_hr.data) == 24

    # By Category
    res_cat = api_client.get("/api/stats/by-category/")
    assert res_cat.status_code == 200

    # Risk Distribution
    res_rd = api_client.get("/api/stats/risk-distribution/")
    assert res_rd.status_code == 200
    assert len(res_rd.data) == 3

    # Merchant
    res_merch = api_client.get("/api/stats/merchant/?limit=5")
    assert res_merch.status_code == 200

    # Customer stats
    api_client.force_authenticate(user=d['cust1'])
    res_cust = api_client.get("/api/stats/customer/")
    assert res_cust.status_code == 200
    assert "totalSpentINR" in res_cust.data
