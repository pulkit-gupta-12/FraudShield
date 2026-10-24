from django.db import models
from django.conf import settings
from django.utils import timezone

class Merchant(models.Model):
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, default='General')
    city = models.CharField(max_length=100, default='Mumbai')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.category})"


class Card(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('blocked', 'Blocked'),
    ]
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cards')
    card_number = models.CharField(max_length=30, blank=True, default='')
    last4 = models.CharField(max_length=4)
    brand = models.CharField(max_length=50, default='Visa')
    card_type = models.CharField(max_length=50, default='Visa Platinum')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    spending_limit = models.DecimalField(max_digits=12, decimal_places=2, default=150000.00)
    travel_notice = models.BooleanField(default=False)
    expiry = models.CharField(max_length=10, default='12/28')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.brand} •••• {self.last4} ({self.owner.email})"


class Transaction(models.Model):
    STATUS_CHOICES = [
        ('approved', 'Approved'),
        ('flagged', 'Flagged'),
        ('blocked', 'Blocked'),
        ('confirmed_fraud', 'Confirmed Fraud'),
        ('confirmed_safe', 'Confirmed Safe'),
        ('under_review', 'Under Review'),
    ]
    public_id = models.CharField(max_length=50, unique=True, db_index=True)
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name='transactions', null=True, blank=True)
    merchant = models.ForeignKey(Merchant, on_delete=models.SET_NULL, related_name='transactions', null=True, blank=True)
    merchant_name = models.CharField(max_length=255, blank=True, default='')
    merchant_category = models.CharField(max_length=100, blank=True, default='')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    amount_inr = models.DecimalField(max_digits=12, decimal_places=2)
    city = models.CharField(max_length=100, default='Mumbai')
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    risk_score = models.FloatField(default=0.0, db_index=True)
    scoring_ms = models.FloatField(default=0.0)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='approved', db_index=True)
    true_label = models.CharField(max_length=50, blank=True, null=True)
    model_inputs = models.JSONField(default=dict, blank=True)
    factors = models.JSONField(default=list, blank=True)
    model_version = models.CharField(max_length=50, default='v1.2.0-xgb')
    source = models.CharField(max_length=50, default='seed')

    class Meta:
        indexes = [
            models.Index(fields=['timestamp']),
            models.Index(fields=['risk_score']),
            models.Index(fields=['status']),
            models.Index(fields=['card']),
            models.Index(fields=['merchant']),
        ]

    def save(self, *args, **kwargs):
        if self.card and self.card.status == 'blocked' and self.status not in ('confirmed_fraud', 'confirmed_safe'):
            self.status = 'blocked'
        super().save(*args, **kwargs)

    def band(self, threshold=None, review_floor=None):
        if threshold is None or review_floor is None:
            from apps.ml.ml_service import ml_service
            cfg = ml_service.get_config()
            if threshold is None:
                threshold = cfg['threshold']
            if review_floor is None:
                review_floor = cfg['review_floor']
        if self.risk_score >= threshold:
            return 'high'
        elif self.risk_score >= review_floor:
            return 'review'
        return 'safe'

    def to_display_dict(self, threshold=None, review_floor=None):
        if threshold is None or review_floor is None:
            from apps.ml.ml_service import ml_service
            cfg = ml_service.get_config()
            if threshold is None:
                threshold = cfg['threshold']
            if review_floor is None:
                review_floor = cfg['review_floor']
        card = self.card
        owner = card.owner if card else None
        owner_name = owner.name if owner else ''
        merchant_name = self.merchant_name or (self.merchant.name if self.merchant else '')
        category = self.merchant_category or (self.merchant.category if self.merchant else '')
        card_number = card.card_number if card else ''
        card_last4 = card.last4 if card else ''
        return {
            'id': self.public_id,
            'publicId': self.public_id,
            'cardId': card.id if card else None,
            'cardNumber': card_number,
            'cardLast4': card_last4,
            'last4': card_last4,
            'cardholder': owner_name,
            'customerName': owner_name,
            'userId': owner.id if owner else None,
            'merchant': merchant_name,
            'merchantId': self.merchant.id if self.merchant else None,
            'merchantCategory': category,
            'category': category,
            'amount': float(self.amount_inr),
            'amountINR': float(self.amount_inr),
            'city': self.city,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'riskScore': self.risk_score,
            'scoringMs': self.scoring_ms,
            'band': self.band(threshold, review_floor),
            'status': self.status,
            'trueLabel': self.true_label,
            'factors': self.factors,
            'modelInputs': self.model_inputs,
            'modelVersion': self.model_version,
            'source': self.source,
        }

    get_display_data = to_display_dict

    def __str__(self):
        return f"{self.public_id} - {self.amount_inr} INR ({self.status})"


class Alert(models.Model):
    SEVERITY_CHOICES = [
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('new', 'New'),
        ('in_review', 'In Review'),
        ('escalated', 'Escalated'),
        ('resolved', 'Resolved'),
    ]
    CUSTOMER_RESPONSE_CHOICES = [
        ('none', 'None'),
        ('confirmed_me', 'Confirmed Me'),
        ('not_me', 'Not Me'),
    ]
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='alerts')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='new', db_index=True)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_alerts'
    )
    customer_response = models.CharField(max_length=50, choices=CUSTOMER_RESPONSE_CHOICES, default='none')
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"ALT-{self.id} for {self.transaction.public_id} ({self.status})"


class Case(models.Model):
    STATUS_CHOICES = [
        ('Open', 'Open'),
        ('In Review', 'In Review'),
        ('Escalated', 'Escalated'),
        ('Closed', 'Closed'),
        ('Resolved', 'Resolved'),
        ('Confirmed Fraud', 'Confirmed Fraud'),
    ]
    PRIORITY_CHOICES = [
        ('P1', 'P1'),
        ('P2', 'P2'),
        ('P3', 'P3'),
    ]
    OUTCOME_CHOICES = [
        ('none', 'None'),
        ('fraud', 'Fraud'),
        ('safe', 'Safe'),
        ('escalated', 'Escalated'),
    ]
    alert = models.ForeignKey(Alert, null=True, blank=True, on_delete=models.SET_NULL, related_name='cases')
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='cases')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Open', db_index=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='P2')
    outcome = models.CharField(max_length=50, choices=OUTCOME_CHOICES, default='none')
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_cases'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"CASE-{self.id} ({self.status})"


class CaseNote(models.Model):
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='notes')
    author = models.CharField(max_length=255, default='Analyst')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Note by {self.author} on Case {self.case_id}"


class CaseEvent(models.Model):
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='timeline')
    event_type = models.CharField(max_length=50, default='status_change')
    action = models.CharField(max_length=255)
    text = models.TextField(blank=True, default='')
    actor = models.CharField(max_length=255, default='System')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} on Case {self.case_id}"


class Dispute(models.Model):
    STAGE_CHOICES = [
        ('opened', 'Opened'),
        ('evidence', 'Evidence Submitted'),
        ('review', 'Under Review'),
        ('resolved', 'Resolved'),
    ]
    merchant = models.ForeignKey(Merchant, null=True, blank=True, on_delete=models.SET_NULL, related_name='disputes')
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='disputes')
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='disputes'
    )
    customer_name = models.CharField(max_length=255, blank=True, default='')
    amount_inr = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reason = models.CharField(max_length=255)
    stage = models.CharField(max_length=50, choices=STAGE_CHOICES, default='opened')
    status = models.CharField(max_length=50, default='Submitted')
    outcome = models.CharField(max_length=50, blank=True, default='')
    evidence_notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Dispute {self.id} for {self.transaction.public_id}"


class DisputeEvidence(models.Model):
    dispute = models.ForeignKey(Dispute, on_delete=models.CASCADE, related_name='evidence_files')
    file = models.FileField(upload_to='evidence/%Y/%m/%d/')
    original_name = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Evidence {self.original_name} for Dispute {self.dispute_id}"


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=50, default='alert')
    title = models.CharField(max_length=255)
    body = models.TextField()
    link = models.CharField(max_length=255, blank=True, default='')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notif to {self.user.email}: {self.title}"


class ModelConfig(models.Model):
    version = models.CharField(max_length=50)
    threshold = models.FloatField()
    review_floor = models.FloatField()
    scale_pos_weight = models.FloatField(null=True, blank=True)
    best_params = models.JSONField(default=dict, blank=True)
    trained_at = models.DateTimeField(auto_now_add=True)
    dataset_info = models.JSONField(default=dict, blank=True)
    metrics = models.JSONField(default=dict, blank=True)
    confusion_matrix = models.JSONField(default=dict, blank=True)
    pr_curve = models.JSONField(default=list, blank=True)
    feature_importance = models.JSONField(default=list, blank=True)
    comparison = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"ModelConfig ({self.version}) - Threshold: {self.threshold}"
