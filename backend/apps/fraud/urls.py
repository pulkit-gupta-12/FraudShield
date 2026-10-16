from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.fraud.views import (
    TransactionViewSet,
    AlertViewSet,
    CaseViewSet,
    CardViewSet,
    DisputeViewSet,
    NotificationViewSet,
)

router = DefaultRouter()
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'alerts', AlertViewSet, basename='alert')
router.register(r'cases', CaseViewSet, basename='case')
router.register(r'cards', CardViewSet, basename='card')
router.register(r'disputes', DisputeViewSet, basename='dispute')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
]
