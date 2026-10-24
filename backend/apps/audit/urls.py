from django.urls import path
from apps.audit.views import AuditLogViewSet

audit_list = AuditLogViewSet.as_view({'get': 'list', 'post': 'create'})
audit_detail = AuditLogViewSet.as_view({'get': 'retrieve'})
audit_export = AuditLogViewSet.as_view({'get': 'export_csv'})

urlpatterns = [
    path('audit-logs/export/', audit_export, name='audit_log_export'),
    path('audit-logs/', audit_list, name='audit_log_list'),
    path('audit-logs/<int:pk>/', audit_detail, name='audit_log_detail'),
]
