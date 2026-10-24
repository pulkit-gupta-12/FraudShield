from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.fraud.views import (
    TransactionViewSet,
    AlertViewSet,
    CaseViewSet,
    CardViewSet,
    DisputeViewSet,
    NotificationViewSet,
    MerchantViewSet,
    PatternProfileViewSet,
    POSCardsListView,
    CustomerReportsListView,
)

router = DefaultRouter()
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'alerts', AlertViewSet, basename='alert')
router.register(r'cases', CaseViewSet, basename='case')
router.register(r'cards', CardViewSet, basename='card')
router.register(r'disputes', DisputeViewSet, basename='dispute')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'merchants', MerchantViewSet, basename='merchant')
router.register(r'patterns', PatternProfileViewSet, basename='pattern')

urlpatterns = [
    path('pos/cards/', POSCardsListView.as_view(), name='pos_cards_list'),
    path('reports/mine/', CustomerReportsListView.as_view(), name='customer_reports_mine'),
    path('disputes/<int:pk>/evidence/<int:evidence_id>/', DisputeViewSet.as_view({'get': 'download_evidence'}), name='dispute_evidence_download'),
    path('', include(router.urls)),
]
