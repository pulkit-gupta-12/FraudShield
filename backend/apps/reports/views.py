import csv
import io
from datetime import datetime
from decimal import Decimal

from django.db.models import (
    Count,
    Sum,
    Avg,
    Q,
    Value,
    DecimalField,
    CharField,
)
from django.db.models.functions import TruncDate, Coalesce
from django.http import HttpResponse
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import ScopedQuerySetMixin
from apps.fraud.models import Transaction, Case, Dispute, Merchant
from apps.ml.ml_service import ml_service

ADMIN_REPORTS = [
    'daily_summary',
    'fraud_by_category',
    'analyst_performance',
    'model_performance',
]

MERCHANT_REPORTS = [
    'merchant_summary',
    'merchant_chargebacks',
]


class ReportBuilderView(APIView):
    """
    GET /api/reports/?type=&dateFrom=&dateTo=&format=json|csv
    Role-scoped report builder supporting database aggregation for:
    - Admin: daily_summary, fraud_by_category, analyst_performance, model_performance
    - Merchant: merchant_summary, merchant_chargebacks
    Returns { columns, rows, chart } or CSV download.
    """
    permission_classes = [IsAuthenticated]
    format_kwarg = None

    def perform_content_negotiation(self, request, force=False):
        # Allow format=csv to bypass DRF renderer negotiation and return raw HttpResponse
        return super().perform_content_negotiation(request, force=True)

    def get(self, request):
        user = request.user
        report_type = request.query_params.get('type', '').strip().lower()
        if not report_type:
            raise ValidationError({'type': 'Report type is required.'})

        # Role scoping
        is_admin = user.role == 'admin' or user.is_superuser
        is_merchant = user.role == 'merchant'

        if is_merchant:
            if report_type not in MERCHANT_REPORTS:
                raise PermissionDenied(f"Merchant role does not have permission to access '{report_type}' report.")
        elif is_admin:
            if report_type not in ADMIN_REPORTS and report_type not in MERCHANT_REPORTS:
                raise ValidationError({'type': f"Unknown report type: '{report_type}'."})
        else:
            # Customers and Analysts
            raise PermissionDenied("You do not have permission to access reports.")

        date_from = request.query_params.get('dateFrom')
        date_to = request.query_params.get('dateTo')

        # Builder dispatch
        if report_type == 'daily_summary':
            result = self._build_daily_summary(date_from, date_to)
        elif report_type == 'fraud_by_category':
            result = self._build_fraud_by_category(date_from, date_to)
        elif report_type == 'analyst_performance':
            result = self._build_analyst_performance(date_from, date_to)
        elif report_type == 'model_performance':
            result = self._build_model_performance(date_from, date_to)
        elif report_type == 'merchant_summary':
            result = self._build_merchant_summary(user, date_from, date_to)
        elif report_type == 'merchant_chargebacks':
            result = self._build_merchant_chargebacks(user, date_from, date_to)
        else:
            raise ValidationError({'type': f"Unsupported report type: '{report_type}'."})

        # Format handling
        out_format = request.query_params.get('format', 'json').strip().lower()
        if out_format == 'csv':
            return self._render_csv(result['columns'], result['rows'], report_type)

        return Response(result)

    def _build_daily_summary(self, date_from, date_to):
        qs = Transaction.objects.all()
        if date_from:
            qs = qs.filter(timestamp__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__lte=date_to)

        aggregates = (
            qs.annotate(date=TruncDate('timestamp'))
            .values('date')
            .annotate(
                total_transactions=Count('id'),
                total_amount=Coalesce(Sum('amount_inr'), Value(Decimal(0), output_field=DecimalField())),
                fraud_transactions=Count('id', filter=Q(status='confirmed_fraud') | Q(status='blocked')),
                fraud_amount=Coalesce(Sum('amount_inr', filter=Q(status='confirmed_fraud') | Q(status='blocked')), Value(Decimal(0), output_field=DecimalField())),
                flagged_count=Count('id', filter=Q(status='flagged') | Q(status='under_review')),
                blocked_count=Count('id', filter=Q(status='blocked') | Q(status='confirmed_fraud')),
            )
            .order_by('date')
        )

        columns = ['date', 'totalTransactions', 'totalAmount', 'fraudTransactions', 'fraudAmount', 'flaggedCount', 'blockedCount']
        rows = []
        for agg in aggregates:
            rows.append({
                'date': str(agg['date']) if agg['date'] else '',
                'totalTransactions': agg['total_transactions'],
                'totalAmount': float(agg['total_amount']),
                'fraudTransactions': agg['fraud_transactions'],
                'fraudAmount': float(agg['fraud_amount']),
                'flaggedCount': agg['flagged_count'],
                'blockedCount': agg['blocked_count'],
            })

        chart = {
            'type': 'line',
            'labels': [r['date'] for r in rows],
            'datasets': [
                {'name': 'Total Transactions', 'data': [r['totalTransactions'] for r in rows]},
                {'name': 'Fraud Transactions', 'data': [r['fraudTransactions'] for r in rows]},
            ]
        }
        return {'columns': columns, 'rows': rows, 'chart': chart}

    def _build_fraud_by_category(self, date_from, date_to):
        qs = Transaction.objects.all()
        if date_from:
            qs = qs.filter(timestamp__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__lte=date_to)

        aggregates = (
            qs.values('merchant_category')
            .annotate(
                total_count=Count('id'),
                fraud_count=Count('id', filter=Q(status='confirmed_fraud') | Q(status='blocked')),
                fraud_amount=Coalesce(Sum('amount_inr', filter=Q(status='confirmed_fraud') | Q(status='blocked')), Value(Decimal(0), output_field=DecimalField())),
                total_amount=Coalesce(Sum('amount_inr'), Value(Decimal(0), output_field=DecimalField())),
            )
            .order_by('-total_count')
        )

        columns = ['category', 'totalCount', 'fraudCount', 'fraudRate', 'fraudAmount', 'totalAmount']
        rows = []
        for agg in aggregates:
            cat = agg['merchant_category'] or 'General'
            total = agg['total_count']
            fraud = agg['fraud_count']
            rate = round((fraud / total) * 100.0, 2) if total > 0 else 0.0
            rows.append({
                'category': cat,
                'totalCount': total,
                'fraudCount': fraud,
                'fraudRate': rate,
                'fraudAmount': float(agg['fraud_amount']),
                'totalAmount': float(agg['total_amount']),
            })

        chart = {
            'type': 'bar',
            'labels': [r['category'] for r in rows],
            'datasets': [
                {'name': 'Fraud Count', 'data': [r['fraudCount'] for r in rows]},
                {'name': 'Fraud Rate (%)', 'data': [r['fraudRate'] for r in rows]},
            ]
        }
        return {'columns': columns, 'rows': rows, 'chart': chart}

    def _build_analyst_performance(self, date_from, date_to):
        qs = Case.objects.all()
        if date_from:
            qs = qs.filter(created_at__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__lte=date_to)

        aggregates = (
            qs.values('assignee__name', 'assignee__email')
            .annotate(
                total_cases=Count('id'),
                resolved_cases=Count('id', filter=Q(status='Resolved')),
                fraud_decisions=Count('id', filter=Q(outcome='fraud')),
                safe_decisions=Count('id', filter=Q(outcome='safe')),
                escalated_cases=Count('id', filter=Q(status='Escalated')),
            )
            .order_by('-total_cases')
        )

        columns = ['analyst', 'totalCases', 'resolvedCases', 'fraudDecisions', 'safeDecisions', 'escalatedCases']
        rows = []
        for agg in aggregates:
            name = agg['assignee__name'] or agg['assignee__email'] or 'Unassigned'
            rows.append({
                'analyst': name,
                'totalCases': agg['total_cases'],
                'resolvedCases': agg['resolved_cases'],
                'fraudDecisions': agg['fraud_decisions'],
                'safeDecisions': agg['safe_decisions'],
                'escalatedCases': agg['escalated_cases'],
            })

        chart = {
            'type': 'bar',
            'labels': [r['analyst'] for r in rows],
            'datasets': [
                {'name': 'Resolved Cases', 'data': [r['resolvedCases'] for r in rows]},
                {'name': 'Fraud Decisions', 'data': [r['fraudDecisions'] for r in rows]},
            ]
        }
        return {'columns': columns, 'rows': rows, 'chart': chart}

    def _build_model_performance(self, date_from, date_to):
        try:
            cfg = ml_service.get_config()
            t_val = cfg['threshold']
            rf_val = cfg['review_floor']
        except Exception:
            t_val = 0.521
            rf_val = 0.5

        qs = Transaction.objects.all()
        if date_from:
            qs = qs.filter(timestamp__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__lte=date_to)

        aggregates = (
            qs.annotate(date=TruncDate('timestamp'))
            .values('date')
            .annotate(
                evaluated_count=Count('id'),
                avg_scoring_ms=Coalesce(Avg('scoring_ms'), Value(0.0)),
                high_risk_count=Count('id', filter=Q(risk_score__gte=t_val)),
                review_risk_count=Count('id', filter=Q(risk_score__gte=rf_val, risk_score__lt=t_val)),
                safe_risk_count=Count('id', filter=Q(risk_score__lt=rf_val)),
                confirmed_fraud=Count('id', filter=Q(status='confirmed_fraud')),
            )
            .order_by('date')
        )

        columns = ['date', 'evaluatedCount', 'avgScoringMs', 'highRiskCount', 'reviewRiskCount', 'safeRiskCount', 'confirmedFraud']
        rows = []
        for agg in aggregates:
            rows.append({
                'date': str(agg['date']) if agg['date'] else '',
                'evaluatedCount': agg['evaluated_count'],
                'avgScoringMs': round(float(agg['avg_scoring_ms']), 2),
                'highRiskCount': agg['high_risk_count'],
                'reviewRiskCount': agg['review_risk_count'],
                'safeRiskCount': agg['safe_risk_count'],
                'confirmedFraud': agg['confirmed_fraud'],
            })

        chart = {
            'type': 'line',
            'labels': [r['date'] for r in rows],
            'datasets': [
                {'name': 'Evaluated', 'data': [r['evaluatedCount'] for r in rows]},
                {'name': 'High Risk', 'data': [r['highRiskCount'] for r in rows]},
                {'name': 'Confirmed Fraud', 'data': [r['confirmedFraud'] for r in rows]},
            ]
        }
        return {'columns': columns, 'rows': rows, 'chart': chart}

    def _get_merchant_for_user(self, user):
        merchant = getattr(user, 'merchant', None)
        if not merchant and user.organisation:
            merchant = Merchant.objects.filter(name=user.organisation).first()
        return merchant

    def _build_merchant_summary(self, user, date_from, date_to):
        merchant = self._get_merchant_for_user(user)
        qs = Transaction.objects.all()
        if merchant:
            qs = qs.filter(merchant=merchant)
        else:
            qs = qs.none()

        if date_from:
            qs = qs.filter(timestamp__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__lte=date_to)

        aggregates = (
            qs.annotate(date=TruncDate('timestamp'))
            .values('date')
            .annotate(
                total_transactions=Count('id'),
                total_volume=Coalesce(Sum('amount_inr'), Value(Decimal(0), output_field=DecimalField())),
                approved_count=Count('id', filter=Q(status='approved') | Q(status='confirmed_safe')),
                flagged_count=Count('id', filter=Q(status='flagged') | Q(status='under_review')),
                blocked_count=Count('id', filter=Q(status='blocked') | Q(status='confirmed_fraud')),
            )
            .order_by('date')
        )

        columns = ['date', 'totalTransactions', 'totalVolume', 'approvedCount', 'flaggedCount', 'blockedCount']
        rows = []
        for agg in aggregates:
            rows.append({
                'date': str(agg['date']) if agg['date'] else '',
                'totalTransactions': agg['total_transactions'],
                'totalVolume': float(agg['total_volume']),
                'approvedCount': agg['approved_count'],
                'flaggedCount': agg['flagged_count'],
                'blockedCount': agg['blocked_count'],
            })

        chart = {
            'type': 'line',
            'labels': [r['date'] for r in rows],
            'datasets': [
                {'name': 'Total Transactions', 'data': [r['totalTransactions'] for r in rows]},
                {'name': 'Volume (INR)', 'data': [r['totalVolume'] for r in rows]},
            ]
        }
        return {'columns': columns, 'rows': rows, 'chart': chart}

    def _build_merchant_chargebacks(self, user, date_from, date_to):
        merchant = self._get_merchant_for_user(user)
        qs = Dispute.objects.select_related('transaction')
        if merchant:
            qs = qs.filter(merchant=merchant)
        else:
            qs = qs.none()

        if date_from:
            qs = qs.filter(created_at__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__lte=date_to)

        disputes = qs.order_by('-created_at')
        columns = ['disputeId', 'transactionId', 'amount', 'reason', 'stage', 'status', 'outcome', 'filedAt']
        rows = []
        stage_counts = {}

        for d in disputes:
            st = d.stage or 'opened'
            stage_counts[st] = stage_counts.get(st, 0) + 1
            rows.append({
                'disputeId': d.id,
                'transactionId': d.transaction.public_id if d.transaction else '',
                'amount': float(d.amount_inr),
                'reason': d.reason,
                'stage': d.stage,
                'status': d.status,
                'outcome': d.outcome,
                'filedAt': d.created_at.isoformat() if d.created_at else '',
            })

        chart = {
            'type': 'doughnut',
            'labels': list(stage_counts.keys()),
            'datasets': [{'name': 'Disputes by Stage', 'data': list(stage_counts.values())}]
        }
        return {'columns': columns, 'rows': rows, 'chart': chart}

    def _render_csv(self, columns, rows, report_type):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(columns)
        for row in rows:
            if isinstance(row, dict):
                writer.writerow([row.get(c, '') for c in columns])
            elif isinstance(row, (list, tuple)):
                writer.writerow(row)

        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="report_{report_type}.csv"'
        return response
