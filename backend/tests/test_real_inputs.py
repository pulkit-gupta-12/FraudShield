import pytest
from datetime import datetime
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User
from apps.fraud.models import (
    Card,
    Merchant,
    Transaction,
    Alert,
    Case,
    Dispute,
    Notification,
    CustomerReport,
    PatternProfile,
    ModelConfig,
)
from apps.audit.models import AuditLog


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def test_setup(db):
    """Initializes basic configs, merchants, users, and cards."""
    # Ensure ModelConfig exists
    config, _ = ModelConfig.objects.get_or_create(
        version='v1.0',
        defaults={'threshold': 0.521, 'review_floor': 0.5}
    )

    # Admin
    admin = User.objects.create_superuser(
        email='admin_test@fraudshield.com',
        password='Password123!',
        name='Admin User',
        role='admin',
    )

    # Analyst
    analyst = User.objects.create_user(
        email='analyst_test@fraudshield.com',
        password='Password123!',
        name='Analyst User',
        role='analyst',
        status='active',
        is_active=True,
    )

    # Merchant Org & Merchant User
    merchant = Merchant.objects.create(
        name='Croma Electronics',
        category='Electronics',
        city='Mumbai',
        active=True
    )
    other_merchant = Merchant.objects.create(
        name='Swiggy Orders',
        category='Food',
        city='Bengaluru',
        active=True
    )

    merchant_user = User.objects.create_user(
        email='merchant_test@fraudshield.com',
        password='Password123!',
        name='Merchant User',
        role='merchant',
        merchant=merchant,
        status='active',
        is_active=True,
    )

    # Customers
    cust_a = User.objects.create_user(
        email='cust_a@fraudshield.com',
        password='Password123!',
        name='Aarav Sharma',
        role='customer',
        status='active',
        is_active=True,
    )
    cust_b = User.objects.create_user(
        email='cust_b@fraudshield.com',
        password='Password123!',
        name='Priya Patel',
        role='customer',
        status='active',
        is_active=True,
    )

    # Cards
    card_active = Card.objects.create(
        owner=cust_a,
        card_number='4532 •••• •••• 8821',
        last4='8821',
        brand='Visa',
        card_type='Visa Platinum',
        status='active',
        spending_limit=100000.0,
        expiry='12/28',
    )
    card_blocked = Card.objects.create(
        owner=cust_a,
        card_number='5241 •••• •••• 4129',
        last4='4129',
        brand='Mastercard',
        card_type='Mastercard World',
        status='blocked',
        spending_limit=50000.0,
        expiry='11/27',
    )
    card_cust_b = Card.objects.create(
        owner=cust_b,
        card_number='6071 •••• •••• 9034',
        last4='9034',
        brand='RuPay',
        card_type='RuPay Select',
        status='active',
        spending_limit=75000.0,
        expiry='03/29',
    )

    # Demo pattern
    pattern = PatternProfile.objects.create(
        code='P09',
        label='Late Night Electronics',
        v_values=[-1.5, 0.8, -0.4, 1.2, -0.6, 0.9, -1.1, 0.3, -0.2, -1.4,
                  0.5, -0.8, 0.1, -1.7, 0.2, 0.4, -1.3, 0.6, -0.3, 0.2,
                  -0.1, 0.3, -0.2, 0.1, -0.3, 0.2, 0.1, -0.05],
        typical_amount=10553.40,
        typical_time='10:26',
        true_label=0,
        base_score=0.0758,
    )

    return {
        'admin': admin,
        'analyst': analyst,
        'merchant': merchant,
        'other_merchant': other_merchant,
        'merchant_user': merchant_user,
        'cust_a': cust_a,
        'cust_b': cust_b,
        'card_active': card_active,
        'card_blocked': card_blocked,
        'card_cust_b': card_cust_b,
        'pattern': pattern,
    }


def test_submit_check_order_blocked_card(api_client, test_setup):
    """Check (a): Blocked card must be declined with reason 'card_blocked' and no model score."""
    api_client.force_authenticate(user=test_setup['admin'])
    payload = {
        'cardId': test_setup['card_blocked'].id,
        'merchantId': test_setup['merchant'].id,
        'amount': 500.0,
        'city': 'Mumbai',
        'patternId': test_setup['pattern'].id,
    }
    resp = api_client.post('/api/transactions/submit/', payload, format='json')
    assert resp.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
    data = resp.data
    assert data['decision'] == 'declined'
    assert data['reason'] == 'card_blocked'
    assert data['riskScore'] is None

    # Stored transaction check
    txn = Transaction.objects.get(public_id=data['transaction']['id'])
    assert txn.status == 'declined'
    assert txn.risk_score is None

    # Audit check
    assert AuditLog.objects.filter(action='TRANSACTION_DECLINED').exists()


def test_submit_check_order_limit_exceeded(api_client, test_setup):
    """Check (b): Active card exceeding spending limit must be declined with reason 'limit_exceeded'."""
    api_client.force_authenticate(user=test_setup['cust_a'])
    payload = {
        'cardId': test_setup['card_active'].id,
        'merchantId': test_setup['merchant'].id,
        'amount': 150000.0,  # Limit is 100,000
        'city': 'Mumbai',
        'patternId': test_setup['pattern'].id,
    }
    resp = api_client.post('/api/transactions/submit/', payload, format='json')
    assert resp.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
    data = resp.data
    assert data['decision'] == 'declined'
    assert data['reason'] == 'limit_exceeded'
    assert data['riskScore'] is None

    txn = Transaction.objects.get(public_id=data['transaction']['id'])
    assert txn.status == 'declined'


def test_submit_normal_transaction(api_client, test_setup):
    """Check (c): Active card within limit scores with model and returns bands/reasons."""
    api_client.force_authenticate(user=test_setup['cust_a'])
    payload = {
        'cardId': test_setup['card_active'].id,
        'merchantId': test_setup['merchant'].id,
        'amount': 1200.0,
        'city': 'Mumbai',
        'patternId': test_setup['pattern'].id,
    }
    resp = api_client.post('/api/transactions/submit/', payload, format='json')
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.data
    assert data['decision'] in ('approved', 'review', 'blocked')
    assert isinstance(data['riskScore'], float)
    assert 'threshold' in data
    assert 'reviewFloor' in data
    assert isinstance(data['reasons'], list)
    assert len(data['reasons']) <= 3


def test_same_pattern_scored_at_two_amounts(api_client, test_setup):
    """Verify that scoring the same pattern profile at Rs 500 and Rs 80,000 both execute cleanly."""
    api_client.force_authenticate(user=test_setup['admin'])
    payload_500 = {
        'cardId': test_setup['card_active'].id,
        'merchantId': test_setup['merchant'].id,
        'amount': 500.0,
        'city': 'Mumbai',
        'patternId': test_setup['pattern'].id,
    }
    resp_500 = api_client.post('/api/transactions/submit/', payload_500, format='json')
    assert resp_500.status_code == status.HTTP_201_CREATED
    score_500 = resp_500.data['riskScore']
    assert score_500 is not None

    payload_80k = {
        'cardId': test_setup['card_active'].id,
        'merchantId': test_setup['merchant'].id,
        'amount': 80000.0,
        'city': 'Mumbai',
        'patternId': test_setup['pattern'].id,
    }
    resp_80k = api_client.post('/api/transactions/submit/', payload_80k, format='json')
    assert resp_80k.status_code == status.HTTP_201_CREATED
    score_80k = resp_80k.data['riskScore']
    assert score_80k is not None

    txn_500 = Transaction.objects.get(public_id=resp_500.data['transaction']['id'])
    txn_80k = Transaction.objects.get(public_id=resp_80k.data['transaction']['id'])
    assert txn_500.source == 'staff_entry'
    assert txn_80k.source == 'staff_entry'


def test_permission_scoping_per_role(api_client, test_setup):
    """
    Customer: own card only (source: customer_entry); cannot use other customer's card.
    Merchant: own merchant only (source: merchant_terminal); can use active POS cards.
    Admin/Analyst: any card (source: staff_entry).
    """
    # Customer tries to use Cust B's card -> 403 Forbidden
    api_client.force_authenticate(user=test_setup['cust_a'])
    resp = api_client.post('/api/transactions/submit/', {
        'cardId': test_setup['card_cust_b'].id,
        'merchantId': test_setup['merchant'].id,
        'amount': 500.0,
        'patternId': test_setup['pattern'].id,
    }, format='json')
    assert resp.status_code == status.HTTP_403_FORBIDDEN

    # Customer uses own card -> 201 Created with source 'customer_entry'
    resp_cust = api_client.post('/api/transactions/submit/', {
        'cardId': test_setup['card_active'].id,
        'merchantId': test_setup['merchant'].id,
        'amount': 500.0,
        'patternId': test_setup['pattern'].id,
    }, format='json')
    assert resp_cust.status_code == status.HTTP_201_CREATED
    txn = Transaction.objects.get(public_id=resp_cust.data['transaction']['id'])
    assert txn.source == 'customer_entry'

    # Merchant submits for different merchant -> 403 Forbidden
    api_client.force_authenticate(user=test_setup['merchant_user'])
    resp_bad_merch = api_client.post('/api/transactions/submit/', {
        'cardId': test_setup['card_cust_b'].id,
        'merchantId': test_setup['other_merchant'].id,
        'amount': 500.0,
        'patternId': test_setup['pattern'].id,
    }, format='json')
    assert resp_bad_merch.status_code == status.HTTP_403_FORBIDDEN

    # Merchant submits for own merchant -> 201 Created with source 'merchant_terminal'
    resp_merch = api_client.post('/api/transactions/submit/', {
        'cardId': test_setup['card_cust_b'].id,
        'merchantId': test_setup['merchant'].id,
        'amount': 500.0,
        'patternId': test_setup['pattern'].id,
    }, format='json')
    assert resp_merch.status_code == status.HTTP_201_CREATED
    txn_m = Transaction.objects.get(public_id=resp_merch.data['transaction']['id'])
    assert txn_m.source == 'merchant_terminal'

    # Merchant POS cards endpoint returns masked active cards
    pos_resp = api_client.get('/api/pos/cards/')
    assert pos_resp.status_code == status.HTTP_200_OK
    assert len(pos_resp.data) >= 2
    for c in pos_resp.data:
        assert 'last4' in c
        assert 'brand' in c
        assert 'holderFirstName' in c
        assert 'cardNumber' not in c


def test_customer_report_lifecycle(api_client, test_setup):
    """
    POST /api/transactions/{id}/report/
    - Cardholder only (Cust B cannot report Cust A's transaction)
    - Exactly once per transaction
    - Creates CustomerReport, Case (source 'customer_report'), Alert, and Dispute
    - Dispatches notifications to analysts and merchant
    - Customer can view live status via GET /api/reports/mine/
    """
    # Create an approved transaction for Cust A
    txn = Transaction.objects.create(
        public_id='TXN-TEST-REPORT-01',
        card=test_setup['card_active'],
        merchant=test_setup['merchant'],
        amount=2500.0,
        amount_inr=2500.0,
        city='Mumbai',
        risk_score=0.012,
        status='approved',
        source='customer_entry',
    )

    # Cust B tries to report Cust A's transaction -> 403 Forbidden or 404 Not Found (scoped out)
    api_client.force_authenticate(user=test_setup['cust_b'])
    resp_forbidden = api_client.post(f'/api/transactions/{txn.public_id}/report/', {
        'reason': 'not_mine',
        'note': 'I did not recognize this transaction on my card.'
    }, format='json')
    assert resp_forbidden.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    # Cust A reports transaction -> 201 Created
    api_client.force_authenticate(user=test_setup['cust_a'])
    resp_report = api_client.post(f'/api/transactions/{txn.public_id}/report/', {
        'reason': 'not_mine',
        'note': 'Unrecognized charge at merchant while card in my pocket.'
    }, format='json')
    assert resp_report.status_code == status.HTTP_201_CREATED
    data = resp_report.data
    assert data['reportId'] is not None
    assert data['caseId'] is not None
    assert data['disputeId'] is not None

    # Check CustomerReport model
    cr = CustomerReport.objects.get(transaction=txn)
    assert cr.reason == 'not_mine'
    assert cr.customer == test_setup['cust_a']

    # Check Case created with source 'customer_report'
    case = Case.objects.get(id=data['caseId'])
    assert case.source == 'customer_report'
    assert case.transaction == txn

    # Check Alert created
    assert Alert.objects.filter(transaction=txn).exists()

    # Check Dispute created with stage 'opened'
    disp = Dispute.objects.get(id=data['disputeId'])
    assert disp.stage == 'opened'
    assert disp.reason == 'not_mine'

    # Check notifications dispatched
    assert Notification.objects.filter(user=test_setup['analyst'], type='case').exists()
    assert Notification.objects.filter(user=test_setup['merchant_user'], type='dispute').exists()

    # Exactly once check: duplicate report must be rejected with 400 Bad Request
    resp_dup = api_client.post(f'/api/transactions/{txn.public_id}/report/', {
        'reason': 'not_mine',
        'note': 'Second submission attempt.'
    }, format='json')
    assert resp_dup.status_code == status.HTTP_400_BAD_REQUEST

    # GET /api/reports/mine/ returns the report with live status
    resp_mine = api_client.get('/api/reports/mine/')
    assert resp_mine.status_code == status.HTTP_200_OK
    items = resp_mine.data.get('results', resp_mine.data)
    assert len(items) == 1
    item = items[0]
    assert item['transactionId'] == txn.public_id
    assert item['case']['status'] == case.status
    assert item['dispute']['stage'] == 'opened'


def test_model_feedback_and_stats_calculations(api_client, test_setup):
    """
    Test feedback numbers:
    - confirmedFraud (outcome fraud)
    - falseAlarm (outcome safe on flagged txn)
    - missedFraud (outcome fraud on approved txn)
    - moneyProtected (sum of amounts of confirmed-fraud txns that were blocked or declined)
    - avgReviewMinutes (case created to closed)
    """
    t_now = timezone.now()

    # 1. Blocked transaction confirmed as fraud
    txn_blocked = Transaction.objects.create(
        public_id='TXN-FB-BLOCKED',
        card=test_setup['card_active'],
        merchant=test_setup['merchant'],
        amount=10000.0,
        amount_inr=10000.0,
        risk_score=0.85,
        status='blocked',
    )
    case_1 = Case.objects.create(
        transaction=txn_blocked,
        status='Confirmed Fraud',
        outcome='fraud',
        source='system',
        created_at=t_now,
        closed_at=t_now + timezone.timedelta(minutes=30),
    )

    # 2. Flagged transaction confirmed as safe (false alarm)
    txn_flagged = Transaction.objects.create(
        public_id='TXN-FB-FLAGGED',
        card=test_setup['card_active'],
        merchant=test_setup['merchant'],
        amount=5000.0,
        amount_inr=5000.0,
        risk_score=0.55,
        status='under_review',
    )
    case_2 = Case.objects.create(
        transaction=txn_flagged,
        status='Resolved',
        outcome='safe',
        source='system',
        created_at=t_now,
        closed_at=t_now + timezone.timedelta(minutes=10),
    )

    # 3. Approved transaction confirmed as fraud (missed fraud)
    txn_approved = Transaction.objects.create(
        public_id='TXN-FB-APPROVED',
        card=test_setup['card_active'],
        merchant=test_setup['merchant'],
        amount=3000.0,
        amount_inr=3000.0,
        risk_score=0.05,
        status='approved',
    )
    case_3 = Case.objects.create(
        transaction=txn_approved,
        status='Confirmed Fraud',
        outcome='fraud',
        source='customer_report',
        created_at=t_now,
        closed_at=t_now + timezone.timedelta(minutes=20),
    )

    api_client.force_authenticate(user=test_setup['admin'])
    resp = api_client.get('/api/stats/overview/')
    assert resp.status_code == status.HTTP_200_OK
    data = resp.data

    assert data['confirmedFraud'] == 2  # case_1 and case_3
    assert data['falseAlarms'] == 1     # case_2 (safe on risk_score >= 0.5)
    assert data['missedFraud'] == 1     # case_3 (fraud on risk_score < 0.5)
    assert data['moneyProtected'] == 10000.0  # Only txn_blocked was blocked/declined
    # avgReviewMinutes: (30 + 10 + 20) / 3 = 20.0
    assert data['avgReviewMinutes'] == 20.0


def test_stats_on_empty_database(api_client, test_setup):
    """Every stats endpoint must return 200 with 0s and empty lists on an empty transaction/case database."""
    # Wipe any transactions, alerts, cases, disputes
    Transaction.objects.all().delete()
    Case.objects.all().delete()
    Alert.objects.all().delete()
    Dispute.objects.all().delete()

    api_client.force_authenticate(user=test_setup['admin'])

    # 1. Overview
    resp_overview = api_client.get('/api/stats/overview/')
    assert resp_overview.status_code == status.HTTP_200_OK
    d = resp_overview.data
    assert d['totalTransactions'] == 0
    assert d['fraudCount'] == 0
    assert d['confirmedFraud'] == 0
    assert d['falseAlarms'] == 0
    assert d['missedFraud'] == 0
    assert d['moneyProtected'] == 0.0
    assert d['avgReviewMinutes'] == 0.0

    # 2. Timeseries
    resp_ts = api_client.get('/api/stats/timeseries/')
    assert resp_ts.status_code == status.HTTP_200_OK
    assert isinstance(resp_ts.data, list)
    assert all(item['total'] == 0 for item in resp_ts.data)

    # 3. By Hour
    resp_hour = api_client.get('/api/stats/by-hour/')
    assert resp_hour.status_code == status.HTTP_200_OK
    assert len(resp_hour.data) == 24
    assert all(item['total'] == 0 for item in resp_hour.data)

    # 4. By Category
    resp_cat = api_client.get('/api/stats/by-category/')
    assert resp_cat.status_code == status.HTTP_200_OK
    assert resp_cat.data == []

    # 5. Risk Distribution
    resp_risk = api_client.get('/api/stats/risk-distribution/')
    assert resp_risk.status_code == status.HTTP_200_OK
    assert all(item['count'] == 0 for item in resp_risk.data)

    # 6. Analyst
    resp_analyst = api_client.get('/api/stats/analyst/')
    assert resp_analyst.status_code == status.HTTP_200_OK
    for item in resp_analyst.data:
        assert item['totalCases'] == 0
        assert item['resolved'] == 0
        assert item['avgReviewMinutes'] == 0.0

    # 7. Merchant
    resp_merch = api_client.get('/api/stats/merchant/')
    assert resp_merch.status_code == status.HTTP_200_OK
    assert resp_merch.data == []

    # 8. Customer
    api_client.force_authenticate(user=test_setup['cust_a'])
    resp_cust = api_client.get('/api/stats/customer/')
    assert resp_cust.status_code == status.HTTP_200_OK
    assert resp_cust.data['totalSpentINR'] == 0.0
    assert resp_cust.data['transactionCount'] == 0


def test_admin_entities_merchants_and_cards(api_client, test_setup):
    """
    Merchants: GET, POST, PATCH /api/merchants/ (admin only).
    Issue card: POST /api/cards/ with auto-generated unique last4.
    """
    api_client.force_authenticate(user=test_setup['admin'])

    # 1. Create merchant
    resp_m_create = api_client.post('/api/merchants/', {
        'name': 'Titan Watch Co',
        'category': 'Fashion',
        'city': 'Bengaluru',
        'active': True,
    }, format='json')
    assert resp_m_create.status_code == status.HTTP_201_CREATED
    m_id = resp_m_create.data['id']

    # 2. Patch merchant
    resp_m_patch = api_client.patch(f'/api/merchants/{m_id}/', {'city': 'Hyderabad'}, format='json')
    assert resp_m_patch.status_code == status.HTTP_200_OK
    assert resp_m_patch.data['city'] == 'Hyderabad'

    # Non-admin forbidden
    api_client.force_authenticate(user=test_setup['cust_a'])
    resp_forbidden = api_client.post('/api/merchants/', {'name': 'Hack Store'}, format='json')
    assert resp_forbidden.status_code == status.HTTP_403_FORBIDDEN

    # 3. Admin issues card
    api_client.force_authenticate(user=test_setup['admin'])
    resp_card = api_client.post('/api/cards/', {
        'ownerId': test_setup['cust_b'].id,
        'brand': 'Visa',
        'cardType': 'Visa Platinum',
        'spendingLimit': 120000.0,
    }, format='json')
    assert resp_card.status_code == status.HTTP_201_CREATED
    card_data = resp_card.data
    assert card_data['brand'] == 'Visa'
    assert len(card_data['last4']) == 4
    assert card_data['spendingLimit'] == 120000.0

    # Audit check
    assert AuditLog.objects.filter(action='CARD_ISSUED').exists()


def test_notification_since_polling(api_client, test_setup):
    """GET /api/notifications/?since= filters out older notifications."""
    t_past = timezone.now() - timezone.timedelta(hours=2)
    t_recent = timezone.now()

    n1 = Notification.objects.create(
        user=test_setup['cust_a'],
        type='alert',
        title='Old Alert',
        body='Old notification',
    )
    Notification.objects.filter(id=n1.id).update(created_at=t_past)

    n2 = Notification.objects.create(
        user=test_setup['cust_a'],
        type='alert',
        title='Recent Alert',
        body='Recent notification',
    )

    api_client.force_authenticate(user=test_setup['cust_a'])
    resp_all = api_client.get('/api/notifications/')
    assert resp_all.status_code == status.HTTP_200_OK
    assert resp_all.data['count'] == 2

    cutoff = (timezone.now() - timezone.timedelta(hours=1)).isoformat()
    resp_since = api_client.get(f'/api/notifications/?since={cutoff}')
    assert resp_since.status_code == status.HTTP_200_OK
    assert resp_since.data['count'] == 1
    assert resp_since.data['results'][0]['title'] == 'Recent Alert'


def test_submit_throttling(api_client, test_setup):
    """Submitting transactions over the 30/min rate limit triggers HTTP 429."""
    from django.core.cache import cache
    cache.clear()

    api_client.force_authenticate(user=test_setup['admin'])
    payload = {
        'cardId': test_setup['card_blocked'].id,
        'merchantId': test_setup['merchant'].id,
        'amount': 100.0,
        'patternId': test_setup['pattern'].id,
    }

    statuses = []
    for _ in range(35):
        resp = api_client.post('/api/transactions/submit/', payload, format='json')
        statuses.append(resp.status_code)

    assert status.HTTP_429_TOO_MANY_REQUESTS in statuses


def test_seed_minimal_creates_no_transactions(db):
    """seed_data --minimal must create 0 transactions, alerts, cases, disputes, and notifications."""
    from django.core.management import call_command
    call_command('seed_data', '--minimal')

    assert Transaction.objects.count() == 0
    assert Alert.objects.count() == 0
    assert Case.objects.count() == 0
    assert Dispute.objects.count() == 0
    assert Notification.objects.count() == 0

    assert Merchant.objects.count() == 10
    assert Card.objects.count() == 12
    assert PatternProfile.objects.count() == 20
    assert ModelConfig.objects.exists()
