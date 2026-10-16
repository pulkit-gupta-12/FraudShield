import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.core.cache import cache
from apps.accounts.models import User
from apps.accounts.permissions import IsAdmin, IsAnalyst, IsCustomer, IsMerchant, HasAnyRole
from apps.audit.models import AuditLog

@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def admin_user(db):
    user, _ = User.objects.get_or_create(
        email='admin@fraudshield.com',
        defaults={
            'name': 'Admin User',
            'role': 'admin',
            'status': 'active',
            'is_active': True,
            'is_staff': True,
            'is_superuser': True,
        }
    )
    user.set_password('Admin@123')
    user.status = 'active'
    user.is_active = True
    user.save()
    return user

@pytest.fixture
def analyst_user(db):
    user, _ = User.objects.get_or_create(
        email='analyst@fraudshield.com',
        defaults={
            'name': 'Analyst User',
            'role': 'analyst',
            'status': 'active',
            'is_active': True,
        }
    )
    user.set_password('Analyst@123')
    user.status = 'active'
    user.is_active = True
    user.save()
    return user

@pytest.fixture
def customer_user(db):
    user, _ = User.objects.get_or_create(
        email='customer@fraudshield.com',
        defaults={
            'name': 'Customer User',
            'role': 'customer',
            'status': 'active',
            'is_active': True,
        }
    )
    user.set_password('Customer@123')
    user.status = 'active'
    user.is_active = True
    user.save()
    return user

@pytest.fixture
def pending_user(db):
    user, _ = User.objects.get_or_create(
        email='pending@fraudshield.com',
        defaults={
            'name': 'Pending User',
            'role': 'customer',
            'status': 'pending',
            'is_active': False,
        }
    )
    user.set_password('Password@123')
    user.status = 'pending'
    user.is_active = False
    user.save()
    return user

@pytest.fixture
def disabled_user(db):
    user, _ = User.objects.get_or_create(
        email='disabled@fraudshield.com',
        defaults={
            'name': 'Disabled User',
            'role': 'customer',
            'status': 'disabled',
            'is_active': False,
        }
    )
    user.set_password('Password@123')
    user.status = 'disabled'
    user.is_active = False
    user.save()
    return user


@pytest.mark.django_db
def test_login_success(api_client, admin_user):
    """Test successful login returns access, refresh, and user in camelCase."""
    url = reverse('auth_login')
    payload = {
        'email': 'admin@fraudshield.com',
        'password': 'Admin@123'
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert 'access' in data
    assert 'refresh' in data
    assert 'user' in data
    assert data['user']['email'] == 'admin@fraudshield.com'
    assert data['user']['role'] == 'admin'
    # Check camelCase keys
    assert 'isActive' in data['user'] or 'status' in data['user']

    # Verify audit log recorded
    log = AuditLog.objects.filter(action='LOGIN_SUCCESS', user=admin_user).first()
    assert log is not None


@pytest.mark.django_db
def test_login_failure_invalid_credentials(api_client, admin_user):
    """Test failed login with wrong password returns 401 with standard error shape."""
    url = reverse('auth_login')
    payload = {
        'email': 'admin@fraudshield.com',
        'password': 'WrongPassword999'
    }
    response = api_client.post(url, payload, format='json')
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

    data = response.json()
    assert 'message' in data
    assert 'status' in data
    assert data['status'] == 401

    # Verify audit log recorded
    log = AuditLog.objects.filter(action='LOGIN_FAILED').first()
    assert log is not None


@pytest.mark.django_db
def test_pending_and_disabled_users_blocked(api_client, pending_user, disabled_user):
    """Pending and disabled users cannot log in."""
    url = reverse('auth_login')

    # Pending user
    res_pending = api_client.post(url, {'email': pending_user.email, 'password': 'Password@123'}, format='json')
    assert res_pending.status_code == status.HTTP_401_UNAUTHORIZED
    assert "pending" in res_pending.json().get('message', '').lower()

    # Disabled user
    res_disabled = api_client.post(url, {'email': disabled_user.email, 'password': 'Password@123'}, format='json')
    assert res_disabled.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_refresh_rotation_and_blacklist_after_logout(api_client, admin_user):
    """Test refresh token rotation and blacklisting after logout."""
    login_url = reverse('auth_login')
    refresh_url = reverse('auth_refresh')
    logout_url = reverse('auth_logout')

    # 1. Login
    login_res = api_client.post(login_url, {'email': admin_user.email, 'password': 'Admin@123'}, format='json')
    assert login_res.status_code == 200
    access_token = login_res.json()['access']
    refresh_token = login_res.json()['refresh']

    # 2. Token Refresh - should rotate token
    refresh_res = api_client.post(refresh_url, {'refresh': refresh_token}, format='json')
    assert refresh_res.status_code == 200
    new_access = refresh_res.json()['access']
    new_refresh = refresh_res.json()['refresh']
    assert new_access != access_token
    assert new_refresh != refresh_token

    # 3. Old refresh token should now be blacklisted due to rotation
    stale_res = api_client.post(refresh_url, {'refresh': refresh_token}, format='json')
    assert stale_res.status_code == 401

    # 4. Logout with current new_refresh
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {new_access}')
    logout_res = api_client.post(logout_url, {'refresh': new_refresh}, format='json')
    assert logout_res.status_code == 200
    assert logout_res.json().get('success') is True

    # 5. Using new_refresh after logout must fail
    after_logout_res = api_client.post(refresh_url, {'refresh': new_refresh}, format='json')
    assert after_logout_res.status_code == 401


@pytest.mark.django_db
def test_login_throttling(api_client):
    """Throttling limits rapid login attempts to 5 per minute per IP."""
    url = reverse('auth_login')
    payload = {'email': 'nobody@fraudshield.com', 'password': 'wrong'}

    responses = [api_client.post(url, payload, format='json') for _ in range(7)]
    status_codes = [r.status_code for r in responses]

    # At least the 6th and 7th attempt should be throttled (429)
    assert status.HTTP_429_TOO_MANY_REQUESTS in status_codes
    throttled_res = next(r for r in responses if r.status_code == 429)
    err_data = throttled_res.json()
    assert err_data.get('status') == 429
    assert 'message' in err_data


@pytest.mark.django_db
def test_permission_classes(admin_user, analyst_user, customer_user):
    """Test IsAdmin, IsAnalyst, IsCustomer, IsMerchant, HasAnyRole permission logic."""
    class MockRequest:
        def __init__(self, user):
            self.user = user

    admin_req = MockRequest(admin_user)
    analyst_req = MockRequest(analyst_user)
    customer_req = MockRequest(customer_user)

    is_admin = IsAdmin()
    assert is_admin.has_permission(admin_req, None) is True
    assert is_admin.has_permission(analyst_req, None) is False
    assert is_admin.has_permission(customer_req, None) is False

    is_analyst = IsAnalyst()
    assert is_analyst.has_permission(analyst_req, None) is True
    assert is_analyst.has_permission(admin_req, None) is True  # Admin inherits analyst access
    assert is_analyst.has_permission(customer_req, None) is False

    is_customer = IsCustomer()
    assert is_customer.has_permission(customer_req, None) is True
    assert is_customer.has_permission(admin_req, None) is True

    # HasAnyRole helper
    custom_perm = HasAnyRole('analyst', 'customer')()
    assert custom_perm.has_permission(analyst_req, None) is True
    assert custom_perm.has_permission(customer_req, None) is True
    assert custom_perm.has_permission(admin_req, None) is True


@pytest.mark.django_db
def test_health_check_endpoint(api_client):
    """Public health check endpoint returns 200 with modelLoaded status."""
    url = reverse('api_health')
    res = api_client.get(url)
    assert res.status_code == 200
    data = res.json()
    assert data.get('status') == 'healthy'
    assert data.get('modelLoaded') is True
    assert 'modelVersion' in data

