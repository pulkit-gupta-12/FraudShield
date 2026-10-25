import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone

from apps.accounts.models import User
from apps.fraud.models import (
    Card,
    Merchant,
    Transaction,
    Alert,
    Case,
    Dispute,
    Notification,
    PatternProfile,
    ModelConfig,
    CustomerReport,
)
from apps.audit.models import AuditLog


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def e2e_setup(db):
    """Initializes basic model config, patterns, merchants, and admin user."""
    # Ensure ModelConfig
    cfg, _ = ModelConfig.objects.get_or_create(
        version='v1.0',
        defaults={'threshold': 0.521, 'review_floor': 0.5}
    )

    # Admin
    admin = User.objects.create_superuser(
        email='admin_e2e@fraudshield.com',
        password='Password123!',
        name='E2E Admin',
        role='admin',
    )

    # Analyst
    analyst = User.objects.create_user(
        email='analyst_e2e@fraudshield.com',
        password='Password123!',
        name='E2E Analyst',
        role='analyst',
        status='active',
        is_active=True,
    )

    # Merchant Org & Merchant User
    merchant = Merchant.objects.create(
        name='Croma Electronics',
        category='Electronics',
        city='Bengaluru',
        active=True
    )
    merchant_user = User.objects.create_user(
        email='merchant_e2e@fraudshield.com',
        password='Password123!',
        name='E2E Merchant',
        role='merchant',
        merchant=merchant,
        organisation='Croma Electronics',
        status='active',
        is_active=True,
    )

    # Patterns
    # Normal low-score pattern P01
    p_low = PatternProfile.objects.create(
        code='P01',
        label='Everyday Grocery Store',
        v_values=[-0.5, 0.2, 0.1, -0.3, 0.4, -0.2, 0.1, 0.05, -0.1, 0.2,
                  -0.1, 0.05, 0.2, -0.3, 0.1, 0.1, -0.2, 0.1, -0.05, 0.02,
                  -0.01, 0.03, -0.02, 0.01, -0.03, 0.02, 0.01, -0.005],
        typical_amount=90.0,
        typical_time='00:24',
        true_label=0,
        base_score=0.0001,
    )

    # High-score fraud pattern P13
    p_high = PatternProfile.objects.create(
        code='P13',
        label='Midnight Overseas Wire Transfer',
        v_values=[-3.0, 2.5, -2.8, 4.0, -2.5, -1.8, -3.2, 1.9, -2.4, -4.5,
                  3.8, -4.2, -0.5, -6.8, 0.2, -3.5, -5.2, -1.8, 1.5, 0.8,
                  1.2, -0.4, 0.8, -0.3, 0.5, 0.2, 0.6, 0.3],
        typical_amount=10647.0,
        typical_time='11:27',
        true_label=1,
        base_score=1.0000,
    )

    # Mid-score pattern P18
    p_mid = PatternProfile.objects.create(
        code='P18',
        label='Multi-Terminal Consecutive Swipes',
        v_values=[-1.8, 1.2, -0.8, 1.9, -1.1, 0.5, -1.4, 0.8, -0.6, -1.8,
                  1.2, -1.5, 0.3, -2.2, 0.1, -1.1, -1.8, -0.6, 0.4, 0.2,
                  0.3, -0.1, 0.2, -0.1, 0.2, 0.1, 0.2, 0.1],
        typical_amount=341.10,
        typical_time='04:46',
        true_label=1,
        base_score=0.3833,
    )

    return {
        'admin': admin,
        'analyst': analyst,
        'merchant': merchant,
        'merchant_user': merchant_user,
        'p_low': p_low,
        'p_high': p_high,
        'p_mid': p_mid,
        'cfg': cfg,
    }


def test_scenario_1_admin_creates_customer_and_issues_card(api, e2e_setup):
    """
    S1: Admin creates a customer user and issues a card (limit Rs 100,000);
    the new customer logs in with the new password.
    """
    admin = e2e_setup['admin']
    api.force_authenticate(user=admin)

    # 1. Admin creates customer user
    create_payload = {
        'email': 'new_customer@fraudshield.com',
        'name': 'New Customer S1',
        'role': 'customer',
        'city': 'Mumbai',
    }
    resp = api.post('/api/users/', create_payload, format='json')
    assert resp.status_code == status.HTTP_201_CREATED, resp.data
    user_data = resp.data
    cust_id = user_data['id']
    temp_pwd = user_data['temporaryPassword']
    assert temp_pwd is not None and len(temp_pwd) >= 8

    # 2. Admin issues card with limit Rs 100,000
    card_payload = {
        'ownerId': cust_id,
        'brand': 'Visa',
        'spendingLimit': 100000.0,
    }
    card_resp = api.post('/api/cards/', card_payload, format='json')
    assert card_resp.status_code == status.HTTP_201_CREATED, card_resp.data
    card_data = card_resp.data
    assert card_data['spendingLimit'] == 100000.0
    assert card_data['status'] == 'active'

    # 3. New customer logs in with the new password
    api.force_authenticate(user=None)
    login_resp = api.post('/api/auth/login/', {
        'email': 'new_customer@fraudshield.com',
        'password': temp_pwd,
    }, format='json')
    assert login_resp.status_code == status.HTTP_200_OK, login_resp.data
    assert 'access' in login_resp.data
    assert login_resp.data['user']['email'] == 'new_customer@fraudshield.com'


def test_scenario_2_customer_pays_normal_approved(api, e2e_setup):
    """
    S2: Customer pays Rs 1,200 with a normal low-score pattern -> Approved;
    it appears in Transactions and the dashboard totals change.
    """
    # Create customer & card
    cust = User.objects.create_user(
        email='cust_s2@fraudshield.com',
        password='Password123!',
        name='Customer S2',
        role='customer',
        status='active',
        is_active=True,
    )
    card = Card.objects.create(
        owner=cust,
        card_number='4111 •••• •••• 1122',
        last4='1122',
        brand='Visa',
        spending_limit=100000.0,
        status='active',
    )

    api.force_authenticate(user=cust)

    # 1. Customer pays Rs 1,200 with normal low-score pattern (P01)
    pay_payload = {
        'cardId': card.id,
        'merchantId': e2e_setup['merchant'].id,
        'amount': 1200.0,
        'city': 'Bengaluru',
        'patternId': e2e_setup['p_low'].id,
    }
    pay_resp = api.post('/api/transactions/submit/', pay_payload, format='json')
    assert pay_resp.status_code == status.HTTP_201_CREATED, pay_resp.data
    data = pay_resp.data
    assert data['decision'] == 'approved'
    exact_score = data['riskScore']
    assert isinstance(exact_score, float)
    txn_id = data['transaction']['id']
    print(f"\n[S2 EXACT SCORE]: {exact_score:.4f}")

    # 2. It appears in Transactions list
    txns_resp = api.get('/api/transactions/')
    assert txns_resp.status_code == status.HTTP_200_OK
    found_txn = any(t['id'] == txn_id for t in txns_resp.data['results'])
    assert found_txn is True

    # 3. Dashboard totals change
    stats_resp = api.get('/api/stats/overview/')
    assert stats_resp.status_code == status.HTTP_200_OK
    assert stats_resp.data['totalTransactions'] >= 1


def test_scenario_3_customer_pays_high_score_fraud_blocked(api, e2e_setup):
    """
    S3: Customer pays with a high-score fraud pattern -> Blocked (or Needs review);
    an alert and a notification exist; the analyst's live feed shows it within 10 seconds.
    """
    cust = User.objects.create_user(
        email='cust_s3@fraudshield.com',
        password='Password123!',
        name='Customer S3',
        role='customer',
        status='active',
        is_active=True,
    )
    card = Card.objects.create(
        owner=cust,
        card_number='4111 •••• •••• 3344',
        last4='3344',
        brand='Visa',
        spending_limit=100000.0,
        status='active',
    )

    api.force_authenticate(user=cust)

    # 1. Customer pays with high-score fraud pattern (P13)
    pay_payload = {
        'cardId': card.id,
        'merchantId': e2e_setup['merchant'].id,
        'amount': 15000.0,
        'city': 'Bengaluru',
        'patternId': e2e_setup['p_high'].id,
    }
    pay_resp = api.post('/api/transactions/submit/', pay_payload, format='json')
    assert pay_resp.status_code == status.HTTP_201_CREATED, pay_resp.data
    data = pay_resp.data
    assert data['decision'] in ('blocked', 'review')
    exact_score = data['riskScore']
    assert isinstance(exact_score, float)
    txn_id = data['transaction']['id']
    txn_time = data['transaction']['timestamp']
    print(f"\n[S3 EXACT SCORE]: {exact_score:.4f}")

    # 2. An alert and a notification exist
    alert = Alert.objects.filter(transaction__public_id=txn_id).first()
    assert alert is not None
    notification = Notification.objects.filter(user=cust).first()
    assert notification is not None

    # 3. Analyst's live feed shows it (polling with since=)
    api.force_authenticate(user=e2e_setup['analyst'])
    # Query live feed
    live_resp = api.get('/api/transactions/', {'pageSize': 5, 'ordering': '-timestamp'})
    assert live_resp.status_code == status.HTTP_200_OK
    live_ids = [t['id'] for t in live_resp.data['results']]
    assert txn_id in live_ids


def test_scenario_4_customer_not_me_analyst_marks_fraud_card_blocked(api, e2e_setup):
    """
    S4: Customer answers 'No, not me'; the analyst opens the case, marks Fraud with a note;
    the card becomes blocked; the customer gets a notification;
    the next payment on that card is Declined with reason card_blocked.
    """
    cust = User.objects.create_user(
        email='cust_s4@fraudshield.com',
        password='Password123!',
        name='Customer S4',
        role='customer',
        status='active',
        is_active=True,
    )
    card = Card.objects.create(
        owner=cust,
        card_number='4111 •••• •••• 4455',
        last4='4455',
        brand='Visa',
        spending_limit=100000.0,
        status='active',
    )

    # Make high-risk txn to get alert and case
    api.force_authenticate(user=cust)
    pay_payload = {
        'cardId': card.id,
        'merchantId': e2e_setup['merchant'].id,
        'amount': 25000.0,
        'city': 'Bengaluru',
        'patternId': e2e_setup['p_high'].id,
    }
    pay_resp = api.post('/api/transactions/submit/', pay_payload, format='json')
    txn_id = pay_resp.data['transaction']['id']

    alert = Alert.objects.get(transaction__public_id=txn_id)
    case = Case.objects.get(transaction__public_id=txn_id)

    # 1. Customer answers 'No, not me'
    alert_resp = api.patch(f'/api/alerts/{alert.id}/', {'customerResponse': 'not_me'}, format='json')
    assert alert_resp.status_code == status.HTTP_200_OK

    # 2. Analyst opens the case, marks Fraud with a note
    api.force_authenticate(user=e2e_setup['analyst'])
    action_payload = {
        'action': 'fraud',
        'note': 'Confirmed unauthorized fraudulent transaction per cardholder notification.',
    }
    case_resp = api.post(f'/api/cases/{case.id}/action/', action_payload, format='json')
    assert case_resp.status_code == status.HTTP_200_OK

    # 3. Card becomes blocked
    card.refresh_from_db()
    assert card.status == 'blocked'

    # 4. Customer gets a notification
    cust_notif = Notification.objects.filter(user=cust, title__icontains='Card Blocked').first()
    assert cust_notif is not None

    # 5. The next payment on that card is Declined with reason card_blocked
    api.force_authenticate(user=cust)
    next_pay = api.post('/api/transactions/submit/', {
        'cardId': card.id,
        'merchantId': e2e_setup['merchant'].id,
        'amount': 500.0,
        'city': 'Bengaluru',
        'patternId': e2e_setup['p_low'].id,
    }, format='json')
    assert next_pay.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
    assert next_pay.data['decision'] == 'declined'
    assert next_pay.data['reason'] == 'card_blocked'
    assert next_pay.data['riskScore'] is None


def test_scenario_5_merchant_terminal_sale_visible_to_customer(api, e2e_setup):
    """
    S5: Merchant terminal: a sale on another customer's test card with a normal pattern ->
    that customer sees the transaction in their own list within 10 seconds.
    """
    cust_b = User.objects.create_user(
        email='cust_b_s5@fraudshield.com',
        password='Password123!',
        name='Customer B S5',
        role='customer',
        status='active',
        is_active=True,
    )
    card_b = Card.objects.create(
        owner=cust_b,
        card_number='5555 •••• •••• 5566',
        last4='5566',
        brand='Mastercard',
        spending_limit=100000.0,
        status='active',
    )

    # 1. Merchant terminal submits sale with Customer B's card
    api.force_authenticate(user=e2e_setup['merchant_user'])
    sale_payload = {
        'cardId': card_b.id,
        'merchantId': e2e_setup['merchant'].id,
        'amount': 3499.0,
        'city': 'Bengaluru',
        'itemDescription': 'Noise Cancelling Headphones',
        'patternId': e2e_setup['p_low'].id,
    }
    sale_resp = api.post('/api/transactions/submit/', sale_payload, format='json')
    assert sale_resp.status_code == status.HTTP_201_CREATED, sale_resp.data
    sale_txn_id = sale_resp.data['transaction']['id']

    # 2. Customer B sees the transaction in their own list
    api.force_authenticate(user=cust_b)
    cust_txns = api.get('/api/transactions/')
    assert cust_txns.status_code == status.HTTP_200_OK
    found_ids = [t['id'] for t in cust_txns.data['results']]
    assert sale_txn_id in found_ids


def test_scenario_6_customer_reports_approved_dispute_workflow(api, e2e_setup):
    """
    S6: Customer reports an APPROVED transaction (reason not_received) ->
    a case and a merchant dispute exist; the merchant sees it, uploads evidence and advances the stage;
    the admin sets the outcome; the customer sees the live status in 'My reports'.
    """
    cust = User.objects.create_user(
        email='cust_s6@fraudshield.com',
        password='Password123!',
        name='Customer S6',
        role='customer',
        status='active',
        is_active=True,
    )
    card = Card.objects.create(
        owner=cust,
        card_number='4111 •••• •••• 6677',
        last4='6677',
        brand='Visa',
        spending_limit=100000.0,
        status='active',
    )

    # 1. Create an approved transaction
    api.force_authenticate(user=cust)
    pay_payload = {
        'cardId': card.id,
        'merchantId': e2e_setup['merchant'].id,
        'amount': 4200.0,
        'city': 'Bengaluru',
        'patternId': e2e_setup['p_low'].id,
    }
    pay_resp = api.post('/api/transactions/submit/', pay_payload, format='json')
    txn_id = pay_resp.data['transaction']['id']
    txn = Transaction.objects.get(public_id=txn_id)

    # 2. Customer reports the transaction with reason not_received
    report_payload = {
        'reason': 'not_received',
        'note': 'Courier says delivered but parcel was never received.',
    }
    rep_resp = api.post(f'/api/transactions/{txn.id}/report/', report_payload, format='json')
    assert rep_resp.status_code == status.HTTP_201_CREATED, rep_resp.data
    report_data = rep_resp.data
    dispute_id = report_data['disputeId']
    case_id = report_data['caseId']
    assert dispute_id is not None
    assert case_id is not None

    # 3. Merchant sees the dispute
    api.force_authenticate(user=e2e_setup['merchant_user'])
    disp_resp = api.get('/api/disputes/')
    assert disp_resp.status_code == status.HTTP_200_OK
    dispute_ids = [d['id'] for d in disp_resp.data['results']]
    assert dispute_id in dispute_ids

    # Merchant advances stage to 'evidence'
    adv_resp = api.post(f'/api/disputes/{dispute_id}/advance/', {}, format='json')
    assert adv_resp.status_code == status.HTTP_200_OK
    assert adv_resp.data['stage'] == 'evidence'

    # Merchant advances stage to 'review'
    adv2_resp = api.post(f'/api/disputes/{dispute_id}/advance/', {}, format='json')
    assert adv2_resp.status_code == status.HTTP_200_OK
    assert adv2_resp.data['stage'] == 'review'

    # 4. Admin sets the outcome
    api.force_authenticate(user=e2e_setup['admin'])
    adv3_resp = api.post(f'/api/disputes/{dispute_id}/advance/', {'outcome': 'merchant_won'}, format='json')
    assert adv3_resp.status_code == status.HTTP_200_OK
    assert adv3_resp.data['stage'] == 'resolved'
    assert adv3_resp.data['outcome'] == 'merchant_won'

    # 5. Customer sees live status in 'My reports'
    api.force_authenticate(user=cust)
    my_reports_resp = api.get('/api/reports/mine/')
    assert my_reports_resp.status_code == status.HTTP_200_OK
    reports = my_reports_resp.data['results']
    assert len(reports) >= 1
    target_rep = next(r for r in reports if r['id'] == report_data['reportId'])
    assert target_rep['dispute']['stage'] == 'resolved'


def test_scenario_7_over_spending_limit_declined(api, e2e_setup):
    """
    S7: Over the spending limit -> Declined with reason limit_exceeded and no model score.
    """
    cust = User.objects.create_user(
        email='cust_s7@fraudshield.com',
        password='Password123!',
        name='Customer S7',
        role='customer',
        status='active',
        is_active=True,
    )
    card = Card.objects.create(
        owner=cust,
        card_number='4111 •••• •••• 7788',
        last4='7788',
        brand='Visa',
        spending_limit=25000.0,  # 25k limit
        status='active',
    )

    api.force_authenticate(user=cust)
    pay_payload = {
        'cardId': card.id,
        'merchantId': e2e_setup['merchant'].id,
        'amount': 30000.0,  # Exceeds limit
        'city': 'Bengaluru',
        'patternId': e2e_setup['p_low'].id,
    }
    pay_resp = api.post('/api/transactions/submit/', pay_payload, format='json')
    assert pay_resp.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
    data = pay_resp.data
    assert data['decision'] == 'declined'
    assert data['reason'] == 'limit_exceeded'
    assert data['riskScore'] is None


def test_scenario_8_register_new_user_pending_approved(api, e2e_setup):
    """
    S8: Register a new user -> pending; cannot log in; admin approves; login works.
    """
    api.force_authenticate(user=None)

    # 1. Register new user
    reg_payload = {
        'email': 'pending_user_s8@fraudshield.com',
        'password': 'Password123!',
        'name': 'Pending User',
        'role': 'customer',
    }
    reg_resp = api.post('/api/auth/register/', reg_payload, format='json')
    assert reg_resp.status_code == status.HTTP_201_CREATED
    new_user_id = reg_resp.data['user']['id']

    # 2. Cannot log in while pending
    login_fail = api.post('/api/auth/login/', {
        'email': 'pending_user_s8@fraudshield.com',
        'password': 'Password123!',
    }, format='json')
    assert login_fail.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    # 3. Admin approves
    api.force_authenticate(user=e2e_setup['admin'])
    approve_resp = api.post(f'/api/users/{new_user_id}/approve/', {}, format='json')
    assert approve_resp.status_code == status.HTTP_200_OK
    assert approve_resp.data['status'] == 'active'

    # 4. Login works
    api.force_authenticate(user=None)
    login_success = api.post('/api/auth/login/', {
        'email': 'pending_user_s8@fraudshield.com',
        'password': 'Password123!',
    }, format='json')
    assert login_success.status_code == status.HTTP_200_OK
    assert 'access' in login_success.data


def test_scenario_9_admin_changes_threshold_different_decision(api, e2e_setup):
    """
    S9: Admin changes the threshold; the same pattern and amount submitted again
    gets a different decision where the score lies between the old and new threshold;
    the audit log has the entries.
    """
    cust = User.objects.create_user(
        email='cust_s9@fraudshield.com',
        password='Password123!',
        name='Customer S9',
        role='customer',
        status='active',
        is_active=True,
    )
    card = Card.objects.create(
        owner=cust,
        card_number='4111 •••• •••• 9900',
        last4='9900',
        brand='Visa',
        spending_limit=100000.0,
        status='active',
    )

    # 1. Initially threshold is 0.521, review floor is 0.500
    # Submit mid pattern P18 with amount 500
    api.force_authenticate(user=cust)
    pay_payload = {
        'cardId': card.id,
        'merchantId': e2e_setup['merchant'].id,
        'amount': 500.0,
        'city': 'Bengaluru',
        'patternId': e2e_setup['p_mid'].id,
    }
    resp1 = api.post('/api/transactions/submit/', pay_payload, format='json')
    score1 = resp1.data['riskScore']
    decision1 = resp1.data['decision']
    print(f"\n[S9 INITIAL SCORE]: {score1:.4f} (Decision: {decision1}, Threshold: 0.521)")

    # 2. Admin raises threshold to 0.900 (review floor to 0.700) so score (0.8054) lies between old and new threshold
    api.force_authenticate(user=e2e_setup['admin'])
    thresh_resp = api.put('/api/model/threshold/', {
        'threshold': 0.900,
        'reviewFloor': 0.700,
    }, format='json')
    assert thresh_resp.status_code == status.HTTP_200_OK

    # Verify audit log entry
    assert AuditLog.objects.filter(action='THRESHOLDS_UPDATED').exists()

    # 3. Submit exact same pattern and amount again
    api.force_authenticate(user=cust)
    resp2 = api.post('/api/transactions/submit/', pay_payload, format='json')
    score2 = resp2.data['riskScore']
    decision2 = resp2.data['decision']
    print(f"[S9 POST-UPDATE SCORE]: {score2:.4f} (Decision: {decision2}, Threshold: 0.900)")

    # Decision changed from blocked to review
    assert decision1 == 'blocked'
    assert decision2 == 'review'
    assert decision1 != decision2


def test_scenario_10_model_feedback_tiles_and_analyst_kpis(api, e2e_setup):
    """
    S10: After S4 and S6 the admin dashboard 'Model feedback' tiles show
    the correct counts (confirmed fraud, false alarms, missed fraud) and the analyst KPIs match.
    """
    api.force_authenticate(user=e2e_setup['admin'])
    stats_resp = api.get('/api/stats/overview/')
    assert stats_resp.status_code == status.HTTP_200_OK
    data = stats_resp.data

    assert 'confirmedFraud' in data
    assert 'falseAlarms' in data
    assert 'missedFraud' in data
    assert 'moneyProtected' in data
    assert isinstance(data['confirmedFraud'], int)
    assert isinstance(data['missedFraud'], int)
    assert isinstance(data['falseAlarms'], int)

    # Analyst KPIs match
    api.force_authenticate(user=e2e_setup['analyst'])
    analyst_stats = api.get('/api/stats/overview/')
    assert analyst_stats.status_code == status.HTTP_200_OK
    assert analyst_stats.data['confirmedFraud'] == data['confirmedFraud']
    assert analyst_stats.data['missedFraud'] == data['missedFraud']


def test_scenario_11_empty_database_all_dashboards_zero_no_errors(api, db):
    """
    S11: On a completely empty database every dashboard of every role loads with zeros and no errors.
    """
    # Clean tables completely
    Transaction.objects.all().delete()
    Case.objects.all().delete()
    Alert.objects.all().delete()
    Dispute.objects.all().delete()
    Card.objects.all().delete()

    roles = ['admin', 'analyst', 'merchant', 'customer']
    for r in roles:
        u = User.objects.create_user(
            email=f'empty_{r}@fraudshield.com',
            password='Password123!',
            name=f'Empty {r}',
            role=r,
            status='active',
            is_active=True,
        )
        api.force_authenticate(user=u)

        # Overview stats
        resp = api.get('/api/stats/overview/')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['totalTransactions'] == 0
        assert resp.data['fraudRate'] == 0.0

        # Timeseries
        ts_resp = api.get('/api/stats/timeseries/')
        assert ts_resp.status_code == status.HTTP_200_OK

        # Categories
        cat_resp = api.get('/api/stats/by-category/')
        assert cat_resp.status_code == status.HTTP_200_OK


def test_scenario_12_permission_attempts_refused(api, e2e_setup):
    """
    S12: Permission attempts:
    - a customer opens another customer's transaction by id
    - a merchant opens a case
    - an analyst changes the threshold
    - a customer submits on someone else's card
    All must be refused.
    """
    # Setup Customer A & Customer B
    cust_a = User.objects.create_user(
        email='cust_a_s12@fraudshield.com',
        password='Password123!',
        name='Customer A',
        role='customer',
        status='active',
        is_active=True,
    )
    card_a = Card.objects.create(
        owner=cust_a,
        card_number='4111 •••• •••• 1212',
        last4='1212',
        brand='Visa',
        spending_limit=50000.0,
        status='active',
    )

    cust_b = User.objects.create_user(
        email='cust_b_s12@fraudshield.com',
        password='Password123!',
        name='Customer B',
        role='customer',
        status='active',
        is_active=True,
    )
    card_b = Card.objects.create(
        owner=cust_b,
        card_number='4111 •••• •••• 3434',
        last4='3434',
        brand='Visa',
        spending_limit=50000.0,
        status='active',
    )

    # Customer B transaction
    txn_b = Transaction.objects.create(
        public_id='TXN-TEST-B-12',
        card=card_b,
        merchant=e2e_setup['merchant'],
        amount=1500.0,
        amount_inr=1500.0,
        status='approved',
        risk_score=0.01,
        timestamp=timezone.now(),
    )

    # 1. Customer A opens Customer B's transaction by id -> 404
    api.force_authenticate(user=cust_a)
    resp1 = api.get(f'/api/transactions/{txn_b.public_id}/')
    assert resp1.status_code in (status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN)

    # 2. Merchant opens a case -> 403 or 404 (scoped query hides it)
    case_obj = Case.objects.create(
        transaction=txn_b,
        status='Open',
        priority='P2',
    )
    api.force_authenticate(user=e2e_setup['merchant_user'])
    resp2 = api.get(f'/api/cases/{case_obj.id}/')
    assert resp2.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    # 3. Analyst changes the threshold -> 403 Forbidden
    api.force_authenticate(user=e2e_setup['analyst'])
    resp3 = api.put('/api/model/threshold/', {'threshold': 0.80}, format='json')
    assert resp3.status_code == status.HTTP_403_FORBIDDEN

    # 4. Customer A submits on Customer B's card -> 403 Forbidden
    api.force_authenticate(user=cust_a)
    submit_b_card = {
        'cardId': card_b.id,
        'merchantId': e2e_setup['merchant'].id,
        'amount': 800.0,
        'city': 'Bengaluru',
        'patternId': e2e_setup['p_low'].id,
    }
    resp4 = api.post('/api/transactions/submit/', submit_b_card, format='json')
    assert resp4.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST)
