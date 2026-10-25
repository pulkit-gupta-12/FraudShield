from django.db import models
from django.conf import settings

class AuditLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_logs'
    )
    actor = models.CharField(max_length=255, blank=True, default='')
    role = models.CharField(max_length=50, blank=True, default='')
    action = models.CharField(max_length=100)
    target = models.CharField(max_length=255, blank=True, default='')
    ip_address = models.CharField(max_length=100, blank=True, default='127.0.0.1')
    status = models.CharField(max_length=50, default='SUCCESS')
    details = models.JSONField(default=dict, blank=True)
    is_demo = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at}] {self.action} by {self.actor or self.user} on {self.target}"


def audit(user=None, action="", target="", ip=None, details=None, status="SUCCESS", role=None):
    """
    Standard audit helper to record system events.
    Audit successful login, failed login, logout, and password change.
    """
    actor_str = ""
    actor_role = role or ""

    if user and getattr(user, 'is_authenticated', False):
        actor_str = getattr(user, 'email', str(user))
        if not actor_role:
            actor_role = getattr(user, 'role', '')
    elif isinstance(user, str):
        actor_str = user

    if details is None:
        details = {}
    elif isinstance(details, str):
        details = {"message": details}

    ip_str = ip or '127.0.0.1'

    return AuditLog.objects.create(
        user=user if (user and getattr(user, 'is_authenticated', False)) else None,
        actor=actor_str,
        role=actor_role,
        action=action,
        target=target,
        ip_address=ip_str,
        status=status,
        details=details,
        is_demo=False
    )
