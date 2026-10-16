import csv
import io
from datetime import datetime
from django.db import transaction as db_transaction
from django.db.models import Q
from django.http import HttpResponse, Http404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import ScopedQuerySetMixin, IsAdmin, IsAnalyst
from apps.audit.models import AuditLog
from apps.fraud.models import (
    Card,
    Transaction,
    Alert,
    Case,
    CaseNote,
    CaseEvent,
    Dispute,
    DisputeEvidence,
    Notification,
)
from apps.fraud.serializers import (
    CardSerializer,
    TransactionSerializer,
    AlertSerializer,
    CaseSerializer,
    CaseDetailSerializer,
    CaseNoteSerializer,
    DisputeSerializer,
    NotificationSerializer,
)
from apps.ml.ml_service import ml_service, band, status_for


ORDERING_MAP = {
    'riskscore': 'risk_score',
    'risk_score': 'risk_score',
    'timestamp': 'timestamp',
    'amount': 'amount_inr',
    'amountinr': 'amount_inr',
    'amount_inr': 'amount_inr',
    'customername': 'card__owner__name',
    'customer_name': 'card__owner__name',
    'cardholder': 'card__owner__name',
    'merchant': 'merchant_name',
    'city': 'city',
    'status': 'status',
    'publicid': 'public_id',
    'id': 'id',
}


class TransactionViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TransactionSerializer
    queryset = Transaction.objects.select_related('card', 'card__owner', 'merchant').all()

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        val = self.kwargs[lookup_url_kwarg]

        # Try public_id first, then numeric id
        obj = queryset.filter(Q(public_id=val) | (Q(id=val) if str(val).isdigit() else Q(pk__isnull=True))).first()
        if not obj:
            raise Http404("No Transaction matches the given query.")

        self.check_object_permissions(self.request, obj)
        return obj

    def filter_queryset(self, queryset):
        params = self.request.query_params

        # 1. Band / riskTier filtering
        band_param = params.get('band') or params.get('riskTier')
        if band_param and band_param.upper() != 'ALL':
            try:
                cfg = ml_service.get_config()
                t_val = cfg['threshold']
                rf_val = cfg['review_floor']
            except Exception:
                t_val = 0.521
                rf_val = 0.5

            bp = band_param.lower()
            if bp in ('safe', 'legit', 'approved'):
                queryset = queryset.filter(risk_score__lt=rf_val)
            elif bp in ('review', 'suspicious', 'under_review', 'under review', 'needs review'):
                queryset = queryset.filter(risk_score__gte=rf_val, risk_score__lt=t_val)
            elif bp in ('high', 'fraud', 'blocked', 'likely fraud'):
                queryset = queryset.filter(risk_score__gte=t_val)

        # 2. Status filtering
        status_param = params.get('status')
        if status_param and status_param.upper() != 'ALL':
            sp = status_param.lower().replace(' ', '_')
            queryset = queryset.filter(status__iexact=sp)

        # 3. Category
        category = params.get('category')
        if category and category.upper() != 'ALL':
            queryset = queryset.filter(
                Q(merchant_category__icontains=category) | Q(merchant__category__icontains=category)
            )

        # 4. Date range
        date_from = params.get('dateFrom')
        if date_from:
            queryset = queryset.filter(timestamp__gte=date_from)
        date_to = params.get('dateTo')
        if date_to:
            queryset = queryset.filter(timestamp__lte=date_to)

        # 5. Amount range
        amount_min = params.get('amountMin')
        if amount_min is not None:
            queryset = queryset.filter(amount_inr__gte=float(amount_min))
        amount_max = params.get('amountMax')
        if amount_max is not None:
            queryset = queryset.filter(amount_inr__lte=float(amount_max))

        # 6. Card ID
        card_id = params.get('cardId')
        if card_id:
            queryset = queryset.filter(card_id=card_id)

        # 7. User / Customer ID
        user_id = params.get('userId') or params.get('customerId')
        if user_id:
            queryset = queryset.filter(card__owner_id=user_id)

        # 8. Merchant
        merchant = params.get('merchant')
        if merchant:
            queryset = queryset.filter(
                Q(merchant_name__icontains=merchant) | Q(merchant__name__icontains=merchant)
            )

        # 9. Since (Live feed polling filter)
        since = params.get('since')
        if since:
            try:
                parsed_since = datetime.fromisoformat(since.replace(' ', '+'))
                queryset = queryset.filter(timestamp__gt=parsed_since)
            except Exception:
                queryset = queryset.filter(timestamp__gt=since)

        # 10. Search query
        search = params.get('search')
        if search:
            q = search.strip()
            queryset = queryset.filter(
                Q(public_id__icontains=q) |
                Q(merchant_name__icontains=q) |
                Q(merchant__name__icontains=q) |
                Q(city__icontains=q) |
                Q(card__owner__name__icontains=q) |
                Q(card__last4__icontains=q)
            )

        # 11. Ordering with camelCase mapping and unknown rejection
        ordering = params.get('ordering')
        if ordering:
            order_clauses = []
            for part in ordering.split(','):
                part = part.strip()
                if not part:
                    continue
                desc = part.startswith('-')
                field_name = part[1:] if desc else part
                key = field_name.lower()
                if key not in ORDERING_MAP:
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError({'ordering': [f"Unknown ordering field: '{field_name}'"]})
                db_field = ORDERING_MAP[key]
                order_clauses.append(f"-{db_field}" if desc else db_field)
            if order_clauses:
                queryset = queryset.order_by(*order_clauses)
        else:
            queryset = queryset.order_by('-timestamp')

        return queryset

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        txn = self.get_object()
        if request.user.role not in ('admin', 'analyst') and not request.user.is_superuser:
            return Response({'detail': 'You do not have permission to update transaction status.'}, status=403)

        new_status = request.data.get('status')
        reason = request.data.get('reason', '')
        if not new_status:
            return Response({'detail': 'status field is required'}, status=400)

        txn.status = new_status
        txn.save()

        AuditLog.objects.create(
            actor=request.user.email,
            role=request.user.role,
            action=f'TRANSACTION_{new_status.upper()}',
            target=txn.public_id,
            status='SUCCESS',
            details=f"Transaction status updated to {new_status}. Reason: {reason}",
            ip_address=request.META.get('REMOTE_ADDR', '127.0.0.1'),
        )
        return Response(self.get_serializer(txn).data)

    @action(detail=False, methods=['get'], url_path='export')
    def export_csv(self, request):
        if request.user.role != 'admin' and not request.user.is_superuser:
            return Response({'detail': 'Only administrators can export transaction data.'}, status=403)

        queryset = self.filter_queryset(self.get_queryset())
        try:
            cfg = ml_service.get_config()
            t_val = cfg['threshold']
            rf_val = cfg['review_floor']
        except Exception:
            t_val = 0.521
            rf_val = 0.5

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'id',
            'public_id',
            'cardholder',
            'card_last4',
            'merchant',
            'merchant_category',
            'amount_inr',
            'city',
            'timestamp',
            'risk_score',
            'band',
            'status',
            'scoring_ms',
        ])

        count = 0
        for txn in queryset.iterator():
            count += 1
            cardholder = txn.card.owner.name if txn.card and txn.card.owner else ''
            card_last4 = txn.card.last4 if txn.card else ''
            merchant = txn.merchant_name or (txn.merchant.name if txn.merchant else '')
            category = txn.merchant_category or (txn.merchant.category if txn.merchant else '')
            writer.writerow([
                txn.id,
                txn.public_id,
                cardholder,
                card_last4,
                merchant,
                category,
                float(txn.amount_inr),
                txn.city,
                txn.timestamp.isoformat() if txn.timestamp else '',
                txn.risk_score,
                txn.band(t_val, rf_val),
                txn.status,
                txn.scoring_ms,
            ])

        AuditLog.objects.create(
            actor=request.user.email,
            role='admin',
            action='TRANSACTIONS_EXPORT_CSV',
            target='Transactions',
            status='SUCCESS',
            details=f"Admin exported {count} transactions to CSV.",
            ip_address=request.META.get('REMOTE_ADDR', '127.0.0.1'),
        )

        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="transactions_export.csv"'
        return response


class AlertViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AlertSerializer
    queryset = Alert.objects.select_related('transaction', 'transaction__card', 'transaction__card__owner', 'assignee').all()

    def filter_queryset(self, queryset):
        params = self.request.query_params
        status_param = params.get('status')
        if status_param and status_param.upper() != 'ALL':
            queryset = queryset.filter(status__iexact=status_param)

        severity_param = params.get('severity')
        if severity_param and severity_param.upper() != 'ALL':
            queryset = queryset.filter(severity__iexact=severity_param)

        user_id = params.get('userId') or params.get('customerId')
        if user_id:
            queryset = queryset.filter(transaction__card__owner_id=user_id)

        customer_name = params.get('customerName')
        if customer_name:
            queryset = queryset.filter(transaction__card__owner__name__icontains=customer_name)

        search = params.get('search')
        if search:
            q = search.strip()
            queryset = queryset.filter(
                Q(transaction__public_id__icontains=q) |
                Q(transaction__merchant_name__icontains=q) |
                Q(transaction__card__owner__name__icontains=q)
            )

        ordering = params.get('ordering', '-created_at')
        if ordering:
            clean_ord = ordering.replace('timestamp', 'created_at').replace('amountINR', 'transaction__amount_inr')
            queryset = queryset.order_by(clean_ord)

        return queryset

    def partial_update(self, request, *args, **kwargs):
        alert = self.get_object()
        user = request.user
        data = request.data

        # Customer response flow
        customer_response = data.get('customerResponse') or data.get('customer_response')
        status_val = data.get('status')

        # Normalize status aliases
        if status_val == 'safe_confirmed':
            customer_response = 'confirmed_me'
        elif status_val == 'fraud_confirmed':
            customer_response = 'not_me'

        if customer_response in ('confirmed_me', 'not_me'):
            alert.customer_response = customer_response
            txn = alert.transaction
            case = Case.objects.filter(transaction=txn).first()

            if customer_response == 'not_me':
                alert.status = 'escalated'
                alert.severity = 'critical'
                alert.save()

                if case:
                    case.status = 'Escalated'
                    case.priority = 'P1'
                    case.save()
                    CaseEvent.objects.create(
                        case=case,
                        event_type='customer_response',
                        action='Customer Response: Not Me',
                        text=f"Cardholder reported unauthorized charge on transaction {txn.public_id}.",
                        actor=user.name or user.email,
                    )

                # Notify analysts
                from apps.accounts.models import User
                for analyst in User.objects.filter(role='analyst', is_active=True):
                    Notification.objects.create(
                        user=analyst,
                        type='alert',
                        title='Alert Escalated by Customer',
                        body=f"Cardholder answered 'Not Me' on transaction {txn.public_id} (Alert #{alert.id}).",
                        link=f"/analyst/cases/{case.id if case else ''}",
                    )

            elif customer_response == 'confirmed_me':
                alert.status = 'resolved'
                alert.resolved_at = timezone.now()
                alert.save()

                txn.status = 'confirmed_safe'
                txn.save()

                if case:
                    case.status = 'Closed'
                    case.outcome = 'safe'
                    case.closed_at = timezone.now()
                    case.save()
                    CaseEvent.objects.create(
                        case=case,
                        event_type='customer_response',
                        action='Customer Response: Confirmed Me',
                        text=f"Cardholder confirmed transaction {txn.public_id} was authorized.",
                        actor=user.name or user.email,
                    )

            AuditLog.objects.create(
                actor=user.email,
                role=user.role,
                action='ALERT_CUSTOMER_RESPONSE',
                target=f"Alert #{alert.id}",
                status='SUCCESS',
                details=f"Customer responded {customer_response} to Alert #{alert.id}.",
                ip_address=request.META.get('REMOTE_ADDR', '127.0.0.1'),
            )
            return Response(self.get_serializer(alert).data)

        # Analyst / Admin update flow
        if user.role not in ('admin', 'analyst') and not user.is_superuser:
            return Response({'detail': 'Only analysts and admins can update alert status/assignee.'}, status=403)

        if 'status' in data:
            alert.status = data['status']
            if data['status'] == 'resolved':
                alert.resolved_at = timezone.now()

        if 'assignee' in data:
            assignee_val = data['assignee']
            from apps.accounts.models import User
            if isinstance(assignee_val, int) or (isinstance(assignee_val, str) and assignee_val.isdigit()):
                alert.assignee = User.objects.filter(id=int(assignee_val)).first()
            elif isinstance(assignee_val, str):
                alert.assignee = User.objects.filter(Q(email=assignee_val) | Q(name=assignee_val)).first()
            elif assignee_val is None:
                alert.assignee = None

        alert.save()
        return Response(self.get_serializer(alert).data)

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk_action(self, request):
        if request.user.role not in ('admin', 'analyst') and not request.user.is_superuser:
            return Response({'detail': 'Permission denied.'}, status=403)

        action_name = request.data.get('action')
        alert_ids = request.data.get('alertIds') or request.data.get('alert_ids') or []
        if not action_name or not alert_ids:
            return Response({'detail': 'action and alertIds are required.'}, status=400)

        with db_transaction.atomic():
            qs = Alert.objects.filter(id__in=alert_ids)
            if action_name == 'assign':
                assignee_val = request.data.get('assignee')
                from apps.accounts.models import User
                assignee_user = None
                if isinstance(assignee_val, int) or (isinstance(assignee_val, str) and assignee_val.isdigit()):
                    assignee_user = User.objects.filter(id=int(assignee_val)).first()
                elif isinstance(assignee_val, str):
                    assignee_user = User.objects.filter(Q(email=assignee_val) | Q(name=assignee_val)).first()
                updated_count = qs.update(assignee=assignee_user, status='in_review')
            elif action_name == 'resolve':
                updated_count = qs.update(status='resolved', resolved_at=timezone.now())
            else:
                return Response({'detail': f"Unknown bulk action '{action_name}'."}, status=400)

            AuditLog.objects.create(
                actor=request.user.email,
                role=request.user.role,
                action=f"ALERT_BULK_{action_name.upper()}",
                target="Alerts",
                status='SUCCESS',
                details=f"Bulk {action_name} executed on {updated_count} alerts.",
                ip_address=request.META.get('REMOTE_ADDR', '127.0.0.1'),
            )

        return Response({'updatedCount': updated_count, 'success': True})


class CaseViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Case.objects.select_related(
        'transaction', 'transaction__card', 'transaction__card__owner', 'alert', 'assignee'
    ).prefetch_related('notes', 'timeline').all()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CaseDetailSerializer
        return CaseSerializer

    def get_permissions(self):
        # Merchants cannot access or open cases
        if self.request.user.is_authenticated and self.request.user.role == 'merchant':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Merchants do not have permission to access or open cases.")
        return super().get_permissions()

    def filter_queryset(self, queryset):
        params = self.request.query_params
        status_param = params.get('status')
        if status_param and status_param.upper() != 'ALL':
            queryset = queryset.filter(status__iexact=status_param)

        priority_param = params.get('priority')
        if priority_param and priority_param.upper() != 'ALL':
            queryset = queryset.filter(priority__iexact=priority_param)

        search = params.get('search')
        if search:
            q = search.strip()
            queryset = queryset.filter(
                Q(transaction__public_id__icontains=q) |
                Q(transaction__card__owner__name__icontains=q) |
                Q(id__icontains=q)
            )

        ordering = params.get('ordering', '-created_at')
        if ordering:
            clean_ord = ordering.replace('createdAt', 'created_at').replace('updatedAt', 'updated_at')
            queryset = queryset.order_by(clean_ord)

        return queryset

    @action(detail=True, methods=['post'], url_path='notes')
    def add_note(self, request, pk=None):
        case = self.get_object()
        text = request.data.get('text', '').strip()
        if not text:
            return Response({'detail': 'text field is required for case note.'}, status=400)

        author = request.user.name or (request.user.email.split('@')[0] if request.user.email else 'Analyst')
        note = CaseNote.objects.create(case=case, author=author, text=text)
        CaseEvent.objects.create(
            case=case,
            event_type='note',
            action='Note Added',
            text=text,
            actor=author,
        )
        return Response(CaseNoteSerializer(note).data, status=201)

    @action(detail=True, methods=['post', 'patch'], url_path='action')
    def perform_action(self, request, pk=None):
        case = self.get_object()
        user = request.user
        data = request.data

        # Determine requested action or status
        action_name = data.get('action')
        status_name = data.get('status')
        note = data.get('note') or data.get('reason')

        if not note or not str(note).strip():
            return Response({'detail': 'A note or reason is required for every case action.'}, status=400)
        note = str(note).strip()

        # Map frontend status names to action
        if not action_name and status_name:
            sn = status_name.lower()
            if 'fraud' in sn:
                action_name = 'fraud'
            elif 'safe' in sn or 'resolve' in sn:
                action_name = 'safe'
            elif 'escalat' in sn:
                action_name = 'escalate'
            else:
                action_name = sn

        if action_name not in ('fraud', 'safe', 'escalate'):
            return Response({'detail': f"Invalid status transition or action: '{action_name}'."}, status=400)

        author = user.name or user.email

        with db_transaction.atomic():
            if action_name == 'fraud':
                case.status = 'Confirmed Fraud'
                case.outcome = 'fraud'
                case.closed_at = timezone.now()
                case.save()

                txn = case.transaction
                txn.status = 'confirmed_fraud'
                txn.save()

                # Card blocked automatically
                card = txn.card
                if card:
                    card.status = 'blocked'
                    card.save()

                # Alert resolved
                if case.alert:
                    case.alert.status = 'resolved'
                    case.alert.resolved_at = timezone.now()
                    case.alert.save()
                Alert.objects.filter(transaction=txn).update(status='resolved', resolved_at=timezone.now())

                # Cardholder notified
                if card and card.owner:
                    Notification.objects.create(
                        user=card.owner,
                        type='alert',
                        title='Card Blocked Due to Confirmed Fraud',
                        body=f"Your card ending in {card.last4} has been automatically blocked due to confirmed fraud on transaction {txn.public_id}.",
                        link=f"/cards",
                    )

                timeline_action = 'Marked as Fraud'

            elif action_name == 'safe':
                case.status = 'Resolved'
                case.outcome = 'safe'
                case.closed_at = timezone.now()
                case.save()

                txn = case.transaction
                txn.status = 'confirmed_safe'
                txn.save()

                if case.alert:
                    case.alert.status = 'resolved'
                    case.alert.resolved_at = timezone.now()
                    case.alert.save()
                Alert.objects.filter(transaction=txn).update(status='resolved', resolved_at=timezone.now())

                timeline_action = 'Marked as Safe'

            elif action_name == 'escalate':
                case.status = 'Escalated'
                case.priority = 'P1'
                case.save()

                timeline_action = 'Case Escalated'

            # Timeline event and Audit Log
            CaseEvent.objects.create(
                case=case,
                event_type='action',
                action=timeline_action,
                text=note,
                actor=author,
            )

            AuditLog.objects.create(
                actor=user.email,
                role=user.role,
                action=f"CASE_{action_name.upper()}",
                target=f"Case #{case.id}",
                status='SUCCESS',
                details=f"Case #{case.id} action '{action_name}' applied. Note: {note}",
                ip_address=request.META.get('REMOTE_ADDR', '127.0.0.1'),
            )

        return Response(CaseDetailSerializer(case, context={'request': request}).data)

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        """Alternative route matching frontend service: PATCH /api/cases/{id}/status/."""
        return self.perform_action(request, pk=pk)


class CardViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CardSerializer
    queryset = Card.objects.select_related('owner').all()

    def filter_queryset(self, queryset):
        params = self.request.query_params
        status_param = params.get('status')
        if status_param and status_param.upper() != 'ALL':
            queryset = queryset.filter(status__iexact=status_param)

        user_id = params.get('userId')
        if user_id:
            queryset = queryset.filter(owner_id=user_id)

        search = params.get('search')
        if search:
            q = search.strip()
            queryset = queryset.filter(
                Q(card_number__icontains=q) |
                Q(last4__icontains=q) |
                Q(card_type__icontains=q) |
                Q(owner__name__icontains=q)
            )

        ordering = params.get('ordering', '-created_at')
        if ordering:
            queryset = queryset.order_by(ordering)
        return queryset

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        card = self.get_object()
        new_status = request.data.get('status')
        if new_status not in ('active', 'blocked'):
            return Response({'detail': f"Invalid status: '{new_status}'."}, status=400)
        card.status = new_status
        card.save()
        return Response(self.get_serializer(card).data)


class DisputeViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = DisputeSerializer
    queryset = Dispute.objects.select_related('customer', 'transaction', 'merchant').prefetch_related('evidence_files').all()

    def filter_queryset(self, queryset):
        params = self.request.query_params
        status_param = params.get('status')
        if status_param and status_param.upper() != 'ALL':
            queryset = queryset.filter(status__iexact=status_param)

        customer_id = params.get('customerId')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        search = params.get('search')
        if search:
            q = search.strip()
            queryset = queryset.filter(
                Q(transaction__public_id__icontains=q) |
                Q(customer_name__icontains=q) |
                Q(reason__icontains=q)
            )

        ordering = params.get('ordering', '-created_at')
        if ordering:
            clean_ord = ordering.replace('filedAt', 'created_at')
            queryset = queryset.order_by(clean_ord)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        txn_id = self.request.data.get('transactionId')
        txn = Transaction.objects.filter(public_id=txn_id).first()
        if not txn and str(txn_id).isdigit():
            txn = Transaction.objects.filter(id=int(txn_id)).first()

        serializer.save(
            customer=user if user.role == 'customer' else None,
            customer_name=user.name or (user.email.split('@')[0] if user.email else 'Customer'),
            transaction=txn,
            merchant=txn.merchant if txn else None,
        )

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        dispute = self.get_object()
        new_status = request.data.get('status')
        if new_status:
            dispute.status = new_status
            dispute.save()
        return Response(self.get_serializer(dispute).data)

    @action(detail=True, methods=['post'], url_path='evidence')
    def upload_evidence(self, request, pk=None):
        dispute = self.get_object()
        files = request.FILES.getlist('files')
        notes = request.data.get('notes', '')

        if notes:
            dispute.evidence_notes = f"{dispute.evidence_notes}\n{notes}".strip()

        for f in files:
            DisputeEvidence.objects.create(
                dispute=dispute,
                file=f,
                original_name=f.name,
                uploaded_by=request.user,
            )

        if dispute.status in ('Submitted', 'Pending', 'Needs Response'):
            dispute.status = 'Evidence Submitted'
            dispute.stage = 'evidence'
        dispute.save()

        return Response(self.get_serializer(dispute).data)


class NotificationViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    queryset = Notification.objects.select_related('user').all()

    def filter_queryset(self, queryset):
        return queryset.order_by('-created_at')

    @action(detail=True, methods=['patch'], url_path='read')
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save()
        return Response(self.get_serializer(notif).data)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        qs = self.get_queryset()
        qs.update(is_read=True)
        return Response({'success': True})

    @action(detail=False, methods=['post'], url_path='read-all')
    def read_all(self, request):
        return self.mark_all_read(request)
