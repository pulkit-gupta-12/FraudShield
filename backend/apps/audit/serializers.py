from rest_framework import serializers
from apps.audit.models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            'id',
            'actor',
            'role',
            'action',
            'target',
            'ip_address',
            'status',
            'details',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
