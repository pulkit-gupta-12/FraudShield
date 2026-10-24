import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User
from apps.fraud.models import Card, Transaction, Dispute, DisputeEvidence, Notification, Merchant
from apps.audit.models import AuditLog


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    user = User.objects.create_superuser(
        email='admin_prime@fraudshield.com',
        password='AdminPassword123!',
        name='Prime Admin',
    )
    return user


@pytest.fixture
def second_admin(db):
    return User.objects.create_user(
        email='second_admin@fraudshield.com',
        password='AdminPassword123!',
        name='Second Admin',
        role='admin',
        status='active',
        is_active=True,
    )


@pytest.fixture
def customer_a(db):
    return User.objects.create_user(
        email='customer_a@fraudshield.com',
        password='Password123!',
        name='Customer Alice',
        role='customer',
        status='active',
        is_active=True,
    )


@pytest.fixture
def customer_b(db):
    return User.objects.create_user(
        email='customer_b@fraudshield.com',
        password='Password123!',
        name='Customer Bob',
        role='customer',
        status='active',
        is_active=True,
    )


@pytest.fixture
def merchant_user(db):
    m = Merchant.objects.create(name='Amazon Pay', category='Shopping')
    u = User.objects.create_user(
        email='merchant@amazon.com',
        password='Password123!',
        name='Amazon Merchant',
        role='merchant',
        organisation='Amazon Pay',
        status='active',
        is_active=True,
        merchant=m,
    )
    return u


@pytest.fixture
def other_merchant_user(db):
    m2 = Merchant.objects.create(name='Flipkart', category='Shopping')
    u = User.objects.create_user(
        email='merchant@flipkart.com',
        password='Password123!',
        name='Flipkart Merchant',
        role='merchant',
        organisation='Flipkart',
        status='active',
        is_active=True,
        merchant=m2,
    )
    return u


# ─── 1. LAST-ADMIN PROTECTION ────────────────────────────────────────────────

@pytest.mark.django_db
def test_admin_cannot_demote_or_deactivate_self(api_client, admin_user, second_admin):
    api_client.force_authenticate(user=admin_user)

    # Self-demotion attempt
    resp = api_client.patch(f'/api/users/{admin_user.id}/', {'role': 'analyst'})
    assert resp.status_code == status.HTTP_400_BAD_REQUEST

    # Self-deactivation attempt
    resp = api_client.patch(f'/api/users/{admin_user.id}/', {'isActive': False})
    assert resp.status_code == status.HTTP_400_BAD_REQUEST

    # Self-suspension attempt via status endpoint
    resp = api_client.patch(f'/api/users/{admin_user.id}/status/', {'status': 'suspended'})
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_last_active_admin_protection(api_client, admin_user, second_admin):
    api_client.force_authenticate(user=admin_user)

    # Deactivate the second admin first so only one active admin remains
    resp = api_client.patch(f'/api/users/{second_admin.id}/status/', {'status': 'suspended'})
    assert resp.status_code == status.HTTP_200_OK

    # Now admin_user is the sole active admin. Attempting to deactivate or demote fails
    resp = api_client.patch(f'/api/users/{admin_user.id}/status/', {'status': 'suspended'})
    assert resp.status_code == status.HTTP_400_BAD_REQUEST

    resp = api_client.patch(f'/api/users/{admin_user.id}/role/', {'role': 'analyst'})
    assert resp.status_code == status.HTTP_400_BAD_REQUEST

    # Delete attempt also fails
    resp = api_client.delete(f'/api/users/{admin_user.id}/')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ─── 2. ACCESS REQUEST APPROVAL & REJECTION ──────────────────────────────────

@pytest.mark.django_db
def test_access_request_approval_and_notification(api_client, admin_user):
    pending_user = User.objects.create_user(
        email='newapplicant@fraudshield.com',
        name='New Applicant',
        role='customer',
        status='pending',
        is_active=False,
    )
    api_client.force_authenticate(user=admin_user)

    # Check access-requests endpoint
    resp = api_client.get('/api/users/access-requests/')
    assert resp.status_code == status.HTTP_200_OK
    assert any(u['id'] == pending_user.id for u in resp.data.get('results', resp.data))

    # Approve access request
    approve_resp = api_client.post(f'/api/users/{pending_user.id}/approve/')
    assert approve_resp.status_code == status.HTTP_200_OK

    pending_user.refresh_from_db()
    assert pending_user.status == 'active'
    assert pending_user.is_active is True

    # Check notification was created for the user
    notif = Notification.objects.filter(user=pending_user).first()
    assert notif is not None
    assert 'Approved' in notif.title

    # Check audit log was created
    audit_entry = AuditLog.objects.filter(action='ACCESS_REQUEST_APPROVED', target=f"User:{pending_user.id}").first()
    assert audit_entry is not None


# ─── 3. CARD OWNERSHIP (404 FOR OTHER PEOPLE'S CARDS) ────────────────────────

@pytest.mark.django_db
def test_card_ownership_404_isolation(api_client, customer_a, customer_b, admin_user):
    card_a = Card.objects.create(
        owner=customer_a,
        card_number='4111111111111234',
        last4='1234',
        status='active',
        spending_limit=50000,
    )

    # Customer B cannot view Card A -> 404
    api_client.force_authenticate(user=customer_b)
    resp = api_client.get(f'/api/cards/{card_a.id}/')
    assert resp.status_code == status.HTTP_404_NOT_FOUND

    # Customer B cannot patch Card A -> 404
    patch_resp = api_client.patch(f'/api/cards/{card_a.id}/', {'status': 'blocked'})
    assert patch_resp.status_code == status.HTTP_404_NOT_FOUND

    # Customer A can view Card A
    api_client.force_authenticate(user=customer_a)
    resp_owner = api_client.get(f'/api/cards/{card_a.id}/')
    assert resp_owner.status_code == status.HTTP_200_OK

    # Customer A can patch status, spendingLimit, travelNotice
    patch_owner = api_client.patch(
        f'/api/cards/{card_a.id}/',
        {'status': 'blocked', 'spendingLimit': 75000, 'travelNotice': True}
    )
    assert patch_owner.status_code == status.HTTP_200_OK
    card_a.refresh_from_db()
    assert card_a.status == 'blocked'
    assert float(card_a.spending_limit) == 75000.0
    assert card_a.travel_notice is True

    # Audit log and Notification created
    assert AuditLog.objects.filter(action='CARD_BLOCKED').exists()
    assert Notification.objects.filter(user=customer_a, type='alert').exists()

    # Blocked card transaction rule: creating a transaction on blocked card forces status to blocked
    txn = Transaction.objects.create(
        public_id='TXN_BLOCKED_TEST_1',
        card=card_a,
        amount=100.0,
        amount_inr=100.0,
        status='approved',  # Attempt approved
    )
    assert txn.status == 'blocked'


# ─── 4. EVIDENCE UPLOAD VALIDATION (WRONG TYPE, FAKE EXTENSION, TOO BIG) ─────

@pytest.mark.django_db
def test_evidence_upload_validation(api_client, merchant_user):
    api_client.force_authenticate(user=merchant_user)
    txn = Transaction.objects.create(
        public_id='TXN_DISPUTE_TEST_1',
        merchant=merchant_user.merchant,
        amount=500.0,
        amount_inr=500.0,
    )
    dispute = Dispute.objects.create(
        transaction=txn,
        merchant=merchant_user.merchant,
        reason='Fraud reported',
        stage='opened',
    )

    # 1. Wrong type (.txt)
    txt_file = SimpleUploadedFile("evidence.txt", b"plain text data", content_type="text/plain")
    resp = api_client.post(f'/api/disputes/{dispute.id}/evidence/', {'files': [txt_file]}, format='multipart')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST

    # 2. Fake extension (.pdf filename with invalid magic bytes)
    fake_pdf = SimpleUploadedFile("fake.pdf", b"NOT_A_REAL_PDF_HEADER", content_type="application/pdf")
    resp_fake = api_client.post(f'/api/disputes/{dispute.id}/evidence/', {'files': [fake_pdf]}, format='multipart')
    assert resp_fake.status_code == status.HTTP_400_BAD_REQUEST

    # 3. File too big (> 5MB)
    huge_data = b'%PDF-1.4 ' + b'0' * (5 * 1024 * 1024 + 100)
    huge_pdf = SimpleUploadedFile("huge.pdf", huge_data, content_type="application/pdf")
    resp_huge = api_client.post(f'/api/disputes/{dispute.id}/evidence/', {'files': [huge_pdf]}, format='multipart')
    assert resp_huge.status_code == status.HTTP_400_BAD_REQUEST

    # 4. Valid PDF accepted
    valid_pdf = SimpleUploadedFile("receipt.pdf", b'%PDF-1.4 valid pdf content', content_type="application/pdf")
    resp_valid = api_client.post(f'/api/disputes/{dispute.id}/evidence/', {'files': [valid_pdf]}, format='multipart')
    assert resp_valid.status_code == status.HTTP_200_OK
    assert dispute.evidence_files.count() == 1


# ─── 5. EVIDENCE ACCESS CONTROL & AUTHENTICATED ENDPOINT ─────────────────────

@pytest.mark.django_db
def test_evidence_access_control(api_client, merchant_user, other_merchant_user, admin_user):
    txn = Transaction.objects.create(
        public_id='TXN_DISPUTE_EVID_1',
        merchant=merchant_user.merchant,
        amount=1000.0,
        amount_inr=1000.0,
    )
    dispute = Dispute.objects.create(
        transaction=txn,
        merchant=merchant_user.merchant,
        reason='Unrecognized charge',
        stage='opened',
    )

    valid_pdf = SimpleUploadedFile("doc.pdf", b'%PDF-1.4 secret evidence content', content_type="application/pdf")
    api_client.force_authenticate(user=merchant_user)
    up_resp = api_client.post(f'/api/disputes/{dispute.id}/evidence/', {'files': [valid_pdf]}, format='multipart')
    assert up_resp.status_code == status.HTTP_200_OK

    evidence = dispute.evidence_files.first()
    assert evidence is not None

    # Other merchant cannot access the evidence -> 404
    api_client.force_authenticate(user=other_merchant_user)
    resp_other = api_client.get(f'/api/disputes/{dispute.id}/evidence/{evidence.id}/')
    assert resp_other.status_code == status.HTTP_404_NOT_FOUND

    # Owning merchant can access
    api_client.force_authenticate(user=merchant_user)
    resp_owner = api_client.get(f'/api/disputes/{dispute.id}/evidence/{evidence.id}/')
    assert resp_owner.status_code == status.HTTP_200_OK
    assert b'%PDF-1.4 secret evidence content' in resp_owner.getvalue()

    # Admin can access
    api_client.force_authenticate(user=admin_user)
    resp_admin = api_client.get(f'/api/disputes/{dispute.id}/evidence/{evidence.id}/')
    assert resp_admin.status_code == status.HTTP_200_OK


# ─── 6. NOTIFICATION ISOLATION BETWEEN USERS ─────────────────────────────────

@pytest.mark.django_db
def test_notification_isolation_and_unread_count(api_client, customer_a, customer_b):
    Notification.objects.create(user=customer_a, title='Notif A1', body='Body A1', is_read=False)
    Notification.objects.create(user=customer_a, title='Notif A2', body='Body A2', is_read=True)
    Notification.objects.create(user=customer_b, title='Notif B1', body='Body B1', is_read=False)

    api_client.force_authenticate(user=customer_a)
    resp_a = api_client.get('/api/notifications/')
    assert resp_a.status_code == status.HTTP_200_OK
    data_a = resp_a.data
    # Customer A sees only their 2 notifications and unreadCount = 1
    assert data_a['count'] == 2
    assert data_a['unreadCount'] == 1
    assert all(n['title'].startswith('Notif A') for n in data_a['results'])

    # Read one
    notif_a1 = Notification.objects.get(title='Notif A1')
    api_client.patch(f'/api/notifications/{notif_a1.id}/', {'isRead': True})
    notif_a1.refresh_from_db()
    assert notif_a1.is_read is True

    # Read all
    api_client.post('/api/notifications/mark-all-read/')
    assert Notification.objects.filter(user=customer_a, is_read=False).count() == 0


# ─── 7. REPORT SCOPING PER ROLE & AUDIT LOGS EXPORT ──────────────────────────

@pytest.mark.django_db
def test_report_scoping_per_role(api_client, admin_user, merchant_user, customer_a):
    # Admin reports
    api_client.force_authenticate(user=admin_user)
    for rep in ['daily_summary', 'fraud_by_category', 'analyst_performance', 'model_performance']:
        resp = api_client.get(f'/api/reports/?type={rep}')
        assert resp.status_code == status.HTTP_200_OK
        assert 'columns' in resp.data
        assert 'rows' in resp.data
        assert 'chart' in resp.data

    # CSV format returns text/csv
    resp_csv = api_client.get('/api/reports/?type=daily_summary&format=csv')
    assert resp_csv.status_code == status.HTTP_200_OK
    assert 'text/csv' in resp_csv['Content-Type']

    # Merchant reports
    api_client.force_authenticate(user=merchant_user)
    for rep in ['merchant_summary', 'merchant_chargebacks']:
        resp = api_client.get(f'/api/reports/?type={rep}')
        assert resp.status_code == status.HTTP_200_OK

    # Merchant attempting admin report -> 403 Forbidden
    resp_forbidden = api_client.get('/api/reports/?type=daily_summary')
    assert resp_forbidden.status_code == status.HTTP_403_FORBIDDEN

    # Customer attempting reports -> 403 Forbidden
    api_client.force_authenticate(user=customer_a)
    resp_cust = api_client.get('/api/reports/?type=daily_summary')
    assert resp_cust.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_audit_logs_filters_and_export(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    AuditLog.objects.create(
        actor='test@fraudshield.com',
        role='admin',
        action='CONFIG_UPDATE',
        target='ModelConfig',
        status='SUCCESS',
    )

    resp = api_client.get('/api/audit-logs/?action=CONFIG_UPDATE')
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data['count'] >= 1

    # Export audit logs
    export_resp = api_client.get('/api/audit-logs/export/')
    assert export_resp.status_code == status.HTTP_200_OK
    assert 'text/csv' in export_resp['Content-Type']

    # Audited export: an entry for AUDIT_LOG_EXPORTED must exist
    assert AuditLog.objects.filter(action='AUDIT_LOG_EXPORTED').exists()


# ─── 8. INTERACTIVE API DOCS (/api/docs/) ────────────────────────────────────

@pytest.mark.django_db
def test_interactive_api_docs(api_client):
    with override_settings(DEBUG=True):
        resp = api_client.get('/api/docs/')
        assert resp.status_code == status.HTTP_200_OK

        resp_schema = api_client.get('/api/schema/')
        assert resp_schema.status_code == status.HTTP_200_OK
