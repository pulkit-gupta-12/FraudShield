import csv
import io
import json
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.models import AuditLog, audit
from apps.audit.serializers import AuditLogSerializer
from apps.accounts.permissions import IsAdmin, ScopedQuerySetMixin

class AuditLogViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    """
    Forensic immutable audit log:
    GET /api/audit-logs/ (filters: user, action, dateFrom, dateTo, search, ordering)
    POST /api/audit-logs/
    GET /api/audit-logs/export/ (CSV export, audited)
    """
    queryset = AuditLog.objects.all().order_by('-created_at')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ['action', 'status', 'role']
    search_fields = ['actor', 'action', 'target', 'ip_address']
    ordering_fields = ['created_at', 'action', 'status']
    format_kwarg = None

    def perform_content_negotiation(self, request, force=False):
        return super().perform_content_negotiation(request, force=True)

    def filter_queryset(self, queryset):
        params = self.request.query_params

        user_filter = params.get('user') or params.get('userId') or params.get('actor')
        if user_filter and user_filter.upper() != 'ALL':
            u_clean = user_filter.strip()
            if u_clean.isdigit():
                queryset = queryset.filter(Q(user_id=int(u_clean)) | Q(actor__icontains=u_clean))
            else:
                queryset = queryset.filter(Q(user__email__icontains=u_clean) | Q(actor__icontains=u_clean))

        action_filter = params.get('action')
        if action_filter and action_filter.upper() != 'ALL':
            queryset = queryset.filter(action__iexact=action_filter)

        status_filter = params.get('status')
        if status_filter and status_filter.upper() != 'ALL':
            queryset = queryset.filter(status__iexact=status_filter)

        date_from = params.get('dateFrom')
        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)

        date_to = params.get('dateTo')
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)

        search = params.get('search')
        if search:
            q = search.strip()
            queryset = queryset.filter(
                Q(actor__icontains=q) |
                Q(action__icontains=q) |
                Q(target__icontains=q) |
                Q(ip_address__icontains=q)
            )

        ordering = params.get('ordering', '-created_at')
        if ordering:
            clean_ord = ordering.replace('timestamp', 'created_at').replace('createdAt', 'created_at')
            queryset = queryset.order_by(clean_ord)

        return queryset

    def list(self, request, *args, **kwargs):
        if request.query_params.get('format') == 'csv':
            return self.export_csv(request)
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        actor = getattr(user, 'email', '') or serializer.validated_data.get('actor', 'System')
        role = getattr(user, 'role', '') or serializer.validated_data.get('role', '')
        serializer.save(user=user, actor=actor, role=role)

    @action(detail=False, methods=['get'], url_path='export')
    def export_csv(self, request):
        audit(
            user=request.user,
            action="AUDIT_LOG_EXPORTED",
            target="AuditLog",
            ip=request.META.get('REMOTE_ADDR', '127.0.0.1'),
            details={"filters": dict(request.query_params)},
            status="SUCCESS",
        )

        queryset = self.filter_queryset(self.get_queryset())
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['id', 'timestamp', 'actor', 'role', 'action', 'target', 'ip_address', 'status', 'details'])

        for log in queryset.iterator():
            writer.writerow([
                log.id,
                log.created_at.isoformat(),
                log.actor,
                log.role,
                log.action,
                log.target,
                log.ip_address,
                log.status,
                json.dumps(log.details) if isinstance(log.details, dict) else str(log.details),
            ])

        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="audit_logs.csv"'
        return response

