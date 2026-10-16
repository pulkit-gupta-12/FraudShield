from rest_framework.permissions import BasePermission
from django.db.models import Q
from django.http import Http404

class IsAdmin(BasePermission):
    """Allows access only to admin users."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.role == 'admin' or request.user.is_superuser)
        )


class IsAnalyst(BasePermission):
    """Allows access to analysts and admins."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ('analyst', 'admin')
        )


class IsCustomer(BasePermission):
    """Allows access to customer users and admins."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ('customer', 'admin')
        )


class IsMerchant(BasePermission):
    """Allows access to merchant users and admins."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ('merchant', 'admin')
        )


def HasAnyRole(*roles):
    """Helper factory to combine roles into a single permission class."""
    class CombinedRolePermission(BasePermission):
        def has_permission(self, request, view):
            if not (request.user and request.user.is_authenticated):
                return False
            if request.user.role == 'admin' or request.user.is_superuser:
                return True
            return request.user.role in roles
    return CombinedRolePermission


class ScopedQuerySetMixin:
    """
    Base queryset-scoping mixin that every later viewset must use,
    so users only get their own data according to their role.
    Admin sees everything.
    Analyst sees all fraud investigation data (transactions, alerts, cases).
    Customer sees only their own cards, transactions, alerts, disputes, and notifications.
    Merchant sees only transactions, disputes, and stats belonging to their merchant.
    """
    customer_field = 'user'  # Field linking to User (or card__owner)
    merchant_field = 'merchant'  # Field linking to Merchant

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, 'user', None)

        if not user or not user.is_authenticated:
            return qs.none()

        # Admin has global visibility
        if user.role == 'admin' or user.is_superuser:
            return qs

        # Analyst has global visibility on fraud investigation entities
        if user.role == 'analyst':
            model_name = qs.model.__name__.lower()
            if model_name in ('transaction', 'alert', 'case', 'casenote', 'caseevent', 'dispute', 'notification', 'card'):
                return qs
            # For user management, analysts cannot see all users
            if model_name == 'user':
                return qs.filter(id=user.id)
            return qs

        # Customer scoping
        if user.role == 'customer':
            model_name = qs.model.__name__.lower()
            if model_name == 'user':
                return qs.filter(id=user.id)
            if model_name == 'card':
                return qs.filter(owner=user)
            if model_name == 'transaction':
                return qs.filter(card__owner=user)
            if model_name == 'alert':
                return qs.filter(transaction__card__owner=user)
            if model_name == 'dispute':
                return qs.filter(customer=user)
            if model_name == 'notification':
                return qs.filter(user=user)
            # Default fallback for customer
            if hasattr(qs.model, 'user'):
                return qs.filter(user=user)
            if hasattr(qs.model, 'owner'):
                return qs.filter(owner=user)
            return qs.none()

        # Merchant scoping
        if user.role == 'merchant':
            merchant = getattr(user, 'merchant', None)
            if not merchant:
                return qs.none()
            model_name = qs.model.__name__.lower()
            if model_name == 'transaction':
                return qs.filter(merchant=merchant)
            if model_name == 'dispute':
                return qs.filter(merchant=merchant)
            if model_name == 'notification':
                return qs.filter(user=user)
            if hasattr(qs.model, 'merchant'):
                return qs.filter(merchant=merchant)
            return qs.none()

        return qs.none()
