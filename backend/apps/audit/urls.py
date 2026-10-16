from django.urls import path
from apps.audit.views import AuditLogViewSet

audit_list = AuditLogViewSet.as_view({'get': 'list', 'post': 'create'})
audit_detail = AuditLogViewSet.as_view({'get': 'retrieve'})

urlpatterns = [
    path('audit-logs/', audit_list, name='audit_log_list'),
    path('audit-logs/<int:pk>/', audit_detail, name='audit_log_detail'),
]
