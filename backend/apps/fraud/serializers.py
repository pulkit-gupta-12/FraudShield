from rest_framework import serializers
from apps.fraud.models import (
    Merchant,
    Card,
    Transaction,
    Alert,
    Case,
    CaseNote,
    CaseEvent,
    Dispute,
    DisputeEvidence,
    Notification,
    ModelConfig,
    PatternProfile,
    CustomerReport,
)
from apps.ml.ml_service import ml_service


class MerchantSerializer(serializers.ModelSerializer):
    isActive = serializers.BooleanField(source='active', required=False)

    class Meta:
        model = Merchant
        fields = ['id', 'name', 'category', 'city', 'active', 'isActive', 'created_at']


class PatternProfileSerializer(serializers.ModelSerializer):
    typicalAmount = serializers.FloatField(source='typical_amount', read_only=True)
    typicalTime = serializers.CharField(source='typical_time', read_only=True)

    class Meta:
        model = PatternProfile
        fields = ['id', 'code', 'label', 'typicalAmount', 'typicalTime']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated and request.user.role in ('admin', 'analyst'):
            ret['trueLabel'] = instance.true_label
            ret['baseScore'] = instance.base_score
        return ret


class POSCardSerializer(serializers.ModelSerializer):
    holderFirstName = serializers.SerializerMethodField()
    last4 = serializers.CharField(read_only=True)
    brand = serializers.CharField(read_only=True)

    class Meta:
        model = Card
        fields = ['id', 'brand', 'last4', 'holderFirstName']

    def get_holderFirstName(self, obj):
        if obj.owner and obj.owner.name:
            return obj.owner.name.split()[0]
        return 'Cardholder'


class CustomerReportSerializer(serializers.ModelSerializer):
    transactionId = serializers.CharField(source='transaction.public_id', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    case = serializers.SerializerMethodField()
    dispute = serializers.SerializerMethodField()

    class Meta:
        model = CustomerReport
        fields = ['id', 'transactionId', 'reason', 'note', 'createdAt', 'case', 'dispute']

    def get_case(self, obj):
        if obj.case:
            return {'id': obj.case.id, 'status': obj.case.status, 'outcome': obj.case.outcome}
        return None

    def get_dispute(self, obj):
        if obj.dispute:
            return {'id': obj.dispute.id, 'stage': obj.dispute.stage, 'status': obj.dispute.status}
        return None


class CardSerializer(serializers.ModelSerializer):
    userId = serializers.IntegerField(source='owner_id', read_only=True)
    cardNumber = serializers.CharField(source='card_number', read_only=True)
    cardType = serializers.CharField(source='card_type', read_only=True)
    holderName = serializers.SerializerMethodField()
    spendingLimit = serializers.FloatField(source='spending_limit', read_only=True)
    travelNotice = serializers.BooleanField(source='travel_notice', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Card
        fields = [
            'id',
            'userId',
            'cardNumber',
            'last4',
            'cardType',
            'brand',
            'holderName',
            'expiry',
            'status',
            'spendingLimit',
            'travelNotice',
            'createdAt',
        ]

    def get_holderName(self, obj):
        return obj.owner.name if obj.owner else ''


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'

    def to_representation(self, instance):
        request = self.context.get('request')
        # Compute dynamic threshold and review floor
        try:
            cfg = ml_service.get_config()
            threshold = cfg.get('threshold')
            review_floor = cfg.get('review_floor')
        except Exception:
            threshold = 0.521
            review_floor = 0.5

        data = instance.to_display_dict(threshold=threshold, review_floor=review_floor)

        # Scoping: modelInputs only visible to admin, analyst, and merchant
        user = getattr(request, 'user', None) if request else None
        if user and user.role == 'customer':
            data.pop('modelInputs', None)

        return data


class AlertSerializer(serializers.ModelSerializer):
    transactionId = serializers.CharField(source='transaction.public_id', read_only=True)
    customerName = serializers.SerializerMethodField()
    userId = serializers.SerializerMethodField()
    customerId = serializers.SerializerMethodField()
    merchant = serializers.SerializerMethodField()
    amountINR = serializers.SerializerMethodField()
    assignee = serializers.SerializerMethodField()
    customerResponse = serializers.CharField(source='customer_response', read_only=True)
    timestamp = serializers.DateTimeField(source='created_at', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    resolvedAt = serializers.DateTimeField(source='resolved_at', read_only=True)

    class Meta:
        model = Alert
        fields = [
            'id',
            'transactionId',
            'customerName',
            'userId',
            'customerId',
            'merchant',
            'amountINR',
            'severity',
            'status',
            'assignee',
            'customerResponse',
            'timestamp',
            'createdAt',
            'resolvedAt',
        ]

    def get_customerName(self, obj):
        card = obj.transaction.card
        return card.owner.name if card and card.owner else ''

    def get_userId(self, obj):
        card = obj.transaction.card
        return card.owner_id if card else None

    get_customerId = get_userId

    def get_merchant(self, obj):
        return obj.transaction.merchant_name or (obj.transaction.merchant.name if obj.transaction.merchant else '')

    def get_amountINR(self, obj):
        return float(obj.transaction.amount_inr)

    def get_assignee(self, obj):
        return obj.assignee.email if obj.assignee else None


class CaseNoteSerializer(serializers.ModelSerializer):
    timestamp = serializers.DateTimeField(source='created_at', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = CaseNote
        fields = ['id', 'author', 'text', 'timestamp', 'createdAt']


class CaseEventSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source='actor', read_only=True)
    note = serializers.CharField(source='text', read_only=True)
    timestamp = serializers.DateTimeField(source='created_at', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = CaseEvent
        fields = ['id', 'action', 'note', 'text', 'user', 'actor', 'event_type', 'timestamp', 'createdAt']


class CaseSerializer(serializers.ModelSerializer):
    caseId = serializers.SerializerMethodField()
    transactionId = serializers.CharField(source='transaction.public_id', read_only=True)
    customerName = serializers.SerializerMethodField()
    assignedTo = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    closedAt = serializers.DateTimeField(source='closed_at', read_only=True)

    class Meta:
        model = Case
        fields = [
            'id',
            'caseId',
            'transactionId',
            'customerName',
            'status',
            'priority',
            'outcome',
            'assignedTo',
            'createdAt',
            'updatedAt',
            'closedAt',
        ]

    def get_caseId(self, obj):
        return f"CASE-{obj.id}"

    def get_customerName(self, obj):
        card = obj.transaction.card
        return card.owner.name if card and card.owner else ''

    def get_assignedTo(self, obj):
        return obj.assignee.name if obj.assignee else (obj.assignee.email if obj.assignee else None)


class CaseDetailSerializer(CaseSerializer):
    transaction = serializers.SerializerMethodField()
    cardholder = serializers.SerializerMethodField()
    card = serializers.SerializerMethodField()
    last5Transactions = serializers.SerializerMethodField()
    notes = CaseNoteSerializer(many=True, read_only=True)
    timeline = serializers.SerializerMethodField()

    class Meta(CaseSerializer.Meta):
        fields = CaseSerializer.Meta.fields + [
            'transaction',
            'cardholder',
            'card',
            'last5Transactions',
            'notes',
            'timeline',
        ]

    def get_transaction(self, obj):
        return TransactionSerializer(obj.transaction, context=self.context).data

    def get_cardholder(self, obj):
        card = obj.transaction.card
        if not card or not card.owner:
            return None
        owner = card.owner
        return {
            'id': owner.id,
            'name': owner.name,
            'email': owner.email,
            'phone': owner.phone,
            'city': owner.city,
            'department': owner.department,
        }

    def get_card(self, obj):
        if not obj.transaction.card:
            return None
        return CardSerializer(obj.transaction.card).data

    def get_last5Transactions(self, obj):
        card = obj.transaction.card
        if not card:
            return []
        recent = Transaction.objects.filter(card=card).exclude(id=obj.transaction_id).order_by('-timestamp')[:5]
        return TransactionSerializer(recent, many=True, context=self.context).data

    def get_timeline(self, obj):
        events = obj.timeline.all().order_by('-created_at')
        return CaseEventSerializer(events, many=True).data


class DisputeEvidenceSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='original_name', read_only=True)
    uploadedAt = serializers.DateTimeField(source='created_at', read_only=True)
    fileUrl = serializers.SerializerMethodField()

    class Meta:
        model = DisputeEvidence
        fields = ['id', 'name', 'uploadedAt', 'fileUrl']

    def get_fileUrl(self, obj):
        return obj.file.url if obj.file else ''


class DisputeSerializer(serializers.ModelSerializer):
    disputeId = serializers.SerializerMethodField()
    transactionId = serializers.CharField(source='transaction.public_id', read_only=True)
    customerId = serializers.IntegerField(source='customer_id', read_only=True)
    customerName = serializers.SerializerMethodField()
    amountINR = serializers.FloatField(source='amount_inr', read_only=True)
    amount = serializers.FloatField(source='amount_inr', read_only=True)
    evidenceNotes = serializers.CharField(source='evidence_notes', read_only=True)
    evidenceFiles = DisputeEvidenceSerializer(source='evidence_files', many=True, read_only=True)
    filedAt = serializers.DateTimeField(source='created_at', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Dispute
        fields = [
            'id',
            'disputeId',
            'transactionId',
            'customerId',
            'customerName',
            'amountINR',
            'amount',
            'reason',
            'stage',
            'status',
            'outcome',
            'evidenceNotes',
            'evidenceFiles',
            'filedAt',
            'createdAt',
        ]

    def get_disputeId(self, obj):
        return f"DSP-{obj.id}"

    def get_customerName(self, obj):
        if obj.customer_name:
            return obj.customer_name
        return obj.customer.name if obj.customer else ''


class NotificationSerializer(serializers.ModelSerializer):
    userId = serializers.IntegerField(source='user_id', read_only=True)
    read = serializers.BooleanField(source='is_read', read_only=True)
    isRead = serializers.BooleanField(source='is_read', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id',
            'userId',
            'type',
            'title',
            'body',
            'link',
            'read',
            'isRead',
            'createdAt',
        ]


class ModelConfigSerializer(serializers.ModelSerializer):
    reviewFloor = serializers.FloatField(source='review_floor', read_only=True)
    modelVersion = serializers.CharField(source='version', read_only=True)
    scalePosWeight = serializers.FloatField(source='scale_pos_weight', read_only=True)
    dataset = serializers.JSONField(source='dataset_info', read_only=True)
    datasetInfo = serializers.JSONField(source='dataset_info', read_only=True)
    confusionMatrix = serializers.JSONField(source='confusion_matrix', read_only=True)
    prCurve = serializers.JSONField(source='pr_curve', read_only=True)
    featureImportance = serializers.JSONField(source='feature_importance', read_only=True)

    class Meta:
        model = ModelConfig
        fields = [
            'id',
            'version',
            'modelVersion',
            'threshold',
            'review_floor',
            'reviewFloor',
            'scale_pos_weight',
            'scalePosWeight',
            'best_params',
            'dataset',
            'datasetInfo',
            'metrics',
            'confusion_matrix',
            'confusionMatrix',
            'pr_curve',
            'prCurve',
            'feature_importance',
            'featureImportance',
            'comparison',
            'trained_at',
        ]
