from rest_framework import viewsets
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from apps.accounts.permissions import IsAdmin, ScopedQuerySetMixin

class AuditLogViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    """
    Forensic immutable audit log:
    GET /api/audit-logs/
    POST /api/audit-logs/
    """
    queryset = AuditLog.objects.all().order_by('-created_at')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ['action', 'status', 'role']
    search_fields = ['actor', 'action', 'target', 'ip_address']
    ordering_fields = ['created_at', 'action', 'status']

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        actor = getattr(user, 'email', '') or serializer.validated_data.get('actor', 'System')
        role = getattr(user, 'role', '') or serializer.validated_data.get('role', '')
        serializer.save(user=user, actor=actor, role=role)
