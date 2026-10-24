from datetime import timedelta
from django.db.models import Count, Sum, Avg, Q
from django.db.models.functions import TruncDate, ExtractHour
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import User
from apps.fraud.models import Card, Transaction, Alert, Case, Dispute
from apps.ml.ml_service import ml_service


def _get_scoped_transactions(user):
    """Returns Transaction queryset scoped to the current user's role."""
    if not user or not user.is_authenticated:
        return Transaction.objects.none()

    if user.role == 'admin' or user.is_superuser or user.role == 'analyst':
        return Transaction.objects.all()

    if user.role == 'customer':
        return Transaction.objects.filter(card__owner=user)

    if user.role == 'merchant':
        merchant = getattr(user, 'merchant', None)
        if not merchant:
            return Transaction.objects.none()
        return Transaction.objects.filter(Q(merchant=merchant) | Q(merchant_name=merchant.name))

    return Transaction.objects.none()


def _parse_range_days(request, default_days=30):
    """Parses range parameter ('7d', '14d', '30d', '90d') or days integer."""
    range_param = request.query_params.get('range')
    days_param = request.query_params.get('days')

    if days_param and str(days_param).isdigit():
        return int(days_param)

    if range_param:
        rp = range_param.lower().strip()
        if rp.endswith('d') and rp[:-1].isdigit():
            return int(rp[:-1])
        if rp == 'week':
            return 7
        if rp == 'month':
            return 30
        if rp == 'quarter':
            return 90

    return default_days


def _compute_feedback_and_case_metrics(scoped_txns=None):
    from apps.ml.ml_service import ml_service
    cfg = ml_service.get_config()
    rf_val = cfg['review_floor']
    t_val = cfg['threshold']

    cases = Case.objects.all()
    if scoped_txns is not None:
        cases = cases.filter(transaction__in=scoped_txns)

    confirmed_fraud = cases.filter(outcome='fraud').count()
    if confirmed_fraud == 0:
        if scoped_txns is not None:
            confirmed_fraud = scoped_txns.filter(status='confirmed_fraud').count()
        else:
            confirmed_fraud = Transaction.objects.filter(status='confirmed_fraud').count()

    false_alarms = cases.filter(
        outcome='safe'
    ).filter(
        Q(transaction__risk_score__gte=rf_val) | Q(alert__isnull=False)
    ).count()

    missed_fraud = cases.filter(
        outcome='fraud'
    ).filter(
        Q(transaction__risk_score__lt=rf_val) | Q(source='customer_report')
    ).count()

    # moneyProtected: sum of amounts of confirmed-fraud transactions that were blocked or declined
    txns = scoped_txns if scoped_txns is not None else Transaction.objects.all()
    prot_aggs = txns.filter(
        Q(status='confirmed_fraud') | Q(cases__outcome='fraud')
    ).filter(
        Q(risk_score__gte=t_val) | Q(status__in=['blocked', 'declined']) | Q(factors__0__description__icontains='declined')
    ).distinct().aggregate(protected=Sum('amount_inr'))
    money_protected = float(prot_aggs['protected'] or 0.0)

    # avgReviewMinutes: case created to closed
    closed_cases = cases.filter(closed_at__isnull=False)
    total_minutes = 0.0
    count_closed = 0
    for c in closed_cases:
        if c.closed_at and c.created_at:
            diff = (c.closed_at - c.created_at).total_seconds() / 60.0
            if diff >= 0:
                total_minutes += diff
                count_closed += 1
    avg_review_minutes = round(total_minutes / count_closed, 1) if count_closed > 0 else 0.0

    return {
        'confirmedFraud': confirmed_fraud,
        'falseAlarms': false_alarms,
        'missedFraud': missed_fraud,
        'moneyProtected': money_protected,
        'avgReviewMinutes': avg_review_minutes,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stats_overview(request):
    """
    GET /api/stats/overview/
    Database aggregation for high-level KPIs and trend calculation against previous period.
    """
    user = request.user
    days = _parse_range_days(request, default_days=30)
    now = timezone.now()
    delta = timedelta(days=days)
    start_current = now - delta
    start_previous = start_current - delta

    cfg = ml_service.get_config()
    t_val = cfg['threshold']
    rf_val = cfg['review_floor']

    base_qs = _get_scoped_transactions(user)
    qs_current = base_qs.filter(timestamp__gte=start_current)
    qs_previous = base_qs.filter(timestamp__gte=start_previous, timestamp__lt=start_current)

    # Database aggregations
    curr_aggs = qs_current.aggregate(
        total=Count('id'),
        volume_inr=Sum('amount_inr'),
        scoring_avg=Avg('scoring_ms'),
        fraud_count=Count('id', filter=Q(risk_score__gte=t_val) | Q(true_label='FRAUD') | Q(status='confirmed_fraud')),
        fraud_volume=Sum('amount_inr', filter=Q(risk_score__gte=t_val) | Q(true_label='FRAUD') | Q(status='confirmed_fraud')),
        suspicious_count=Count('id', filter=Q(risk_score__gte=rf_val, risk_score__lt=t_val)),
        legit_count=Count('id', filter=Q(risk_score__lt=rf_val)),
    )

    prev_aggs = qs_previous.aggregate(
        total=Count('id'),
        volume_inr=Sum('amount_inr'),
        fraud_count=Count('id', filter=Q(risk_score__gte=t_val) | Q(true_label='FRAUD') | Q(status='confirmed_fraud')),
        fraud_volume=Sum('amount_inr', filter=Q(risk_score__gte=t_val) | Q(true_label='FRAUD') | Q(status='confirmed_fraud')),
    )

    # Current totals
    total_txns = curr_aggs['total'] or 0
    all_time_total = base_qs.count()
    effective_total = total_txns if total_txns > 0 else all_time_total

    fraud_cnt = curr_aggs['fraud_count'] or 0
    suspicious_cnt = curr_aggs['suspicious_count'] or 0
    legit_cnt = curr_aggs['legit_count'] or 0
    total_vol = float(curr_aggs['volume_inr'] or 0.0)
    fraud_vol = float(curr_aggs['fraud_volume'] or 0.0)
    avg_detection_ms = round(float(curr_aggs['scoring_avg'] or 0.0), 1) if total_txns > 0 else 0.0

    fraud_rate = round((fraud_cnt / total_txns * 100.0), 2) if total_txns > 0 else (
        round((base_qs.filter(risk_score__gte=t_val).count() / all_time_total * 100.0), 2) if all_time_total > 0 else 0.0
    )

    # Transactions today
    txns_today = base_qs.filter(timestamp__date=now.date()).count()

    # Previous period trends
    prev_total = prev_aggs['total'] or 0
    prev_fraud = prev_aggs['fraud_count'] or 0
    prev_fraud_rate = (prev_fraud / prev_total * 100.0) if prev_total > 0 else 0.0
    prev_fraud_vol = float(prev_aggs['fraud_volume'] or 0.0)

    txns_trend = round(((total_txns - prev_total) / prev_total * 100.0), 1) if prev_total > 0 else 0.0
    fraud_rate_trend = round(fraud_rate - prev_fraud_rate, 2)
    amount_saved_trend = round(((fraud_vol - prev_fraud_vol) / prev_fraud_vol * 100.0), 1) if prev_fraud_vol > 0 else 0.0

    # Role-scoped active alerts, cases, cards
    if user.role == 'customer':
        active_alerts = Alert.objects.filter(transaction__card__owner=user, status__in=['new', 'in_review', 'escalated']).count()
        open_cases = 0
        active_cards = Card.objects.filter(owner=user, status='active').count()
    elif user.role == 'merchant':
        merchant = getattr(user, 'merchant', None)
        active_alerts = Alert.objects.filter(transaction__merchant=merchant, status__in=['new', 'in_review', 'escalated']).count() if merchant else 0
        open_cases = 0
        active_cards = 0
    else:
        active_alerts = Alert.objects.filter(status__in=['new', 'in_review', 'escalated']).count()
        open_cases = Case.objects.filter(status__in=['Open', 'In Review', 'Escalated']).count()
        active_cards = Card.objects.filter(status='active').count()

    feedback_metrics = _compute_feedback_and_case_metrics(base_qs if user.role in ['customer', 'merchant'] else None)

    return Response({
        'totalTransactions': effective_total,
        'transactionsToday': txns_today,
        'fraudCount': fraud_cnt,
        'fraudDetected': fraud_cnt,
        'suspiciousCount': suspicious_cnt,
        'legitCount': legit_cnt,
        'fraudRate': fraud_rate,
        'fraudVolumeINR': fraud_vol,
        'totalVolumeINR': total_vol,
        'amountSaved': fraud_vol,
        'moneyProtected': feedback_metrics['moneyProtected'],
        'confirmedFraud': feedback_metrics['confirmedFraud'],
        'falseAlarms': feedback_metrics['falseAlarms'],
        'missedFraud': feedback_metrics['missedFraud'],
        'avgReviewMinutes': feedback_metrics['avgReviewMinutes'],
        'avgDetectionMs': avg_detection_ms,
        'activeAlerts': active_alerts,
        'openAlerts': active_alerts,
        'openCases': open_cases,
        'activeCards': active_cards,
        'trend': {
            'transactionsTrend': txns_trend,
            'fraudRateTrend': fraud_rate_trend,
            'amountSavedTrend': amount_saved_trend,
            'value': txns_trend,
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stats_timeseries(request):
    """
    GET /api/stats/timeseries/?days=14 or ?range=30d
    Daily trend using SQL TruncDate aggregation.
    """
    user = request.user
    days = _parse_range_days(request, default_days=14)
    now = timezone.now()
    start_date = now - timedelta(days=days)

    cfg = ml_service.get_config()
    t_val = cfg['threshold']
    rf_val = cfg['review_floor']

    base_qs = _get_scoped_transactions(user).filter(timestamp__gte=start_date)

    daily_stats = (
        base_qs
        .annotate(d=TruncDate('timestamp'))
        .values('d')
        .annotate(
            total=Count('id'),
            fraud=Count('id', filter=Q(risk_score__gte=t_val) | Q(true_label='FRAUD') | Q(status='confirmed_fraud')),
            suspicious=Count('id', filter=Q(risk_score__gte=rf_val, risk_score__lt=t_val)),
        )
        .order_by('d')
    )

    stats_by_date = {row['d']: row for row in daily_stats if row['d']}

    # Fill full date range continuity
    results = []
    for i in range(days):
        day_date = (start_date + timedelta(days=i + 1)).date()
        entry = stats_by_date.get(day_date)
        results.append({
            'date': day_date.strftime('%d %b'),
            'total': entry['total'] if entry else 0,
            'fraud': entry['fraud'] if entry else 0,
            'suspicious': entry['suspicious'] if entry else 0,
        })

    return Response(results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stats_by_hour(request):
    """
    GET /api/stats/by-hour/
    Hourly distribution using SQL ExtractHour aggregation.
    """
    user = request.user
    base_qs = _get_scoped_transactions(user)

    cfg = ml_service.get_config()
    t_val = cfg['threshold']

    hourly_stats = (
        base_qs
        .annotate(hour_num=ExtractHour('timestamp'))
        .values('hour_num')
        .annotate(
            total=Count('id'),
            fraud=Count('id', filter=Q(risk_score__gte=t_val) | Q(true_label='FRAUD')),
        )
        .order_by('hour_num')
    )

    hour_map = {row['hour_num']: row for row in hourly_stats if row['hour_num'] is not None}

    results = []
    for h in range(24):
        entry = hour_map.get(h)
        results.append({
            'hour': h,
            'label': f"{h:02d}:00",
            'total': entry['total'] if entry else 0,
            'fraud': entry['fraud'] if entry else 0,
        })

    return Response(results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stats_by_category(request):
    """
    GET /api/stats/by-category/
    Fraud count/rate grouped by merchant category via database aggregation.
    """
    user = request.user
    base_qs = _get_scoped_transactions(user)

    cfg = ml_service.get_config()
    t_val = cfg['threshold']

    cat_stats = (
        base_qs
        .values('merchant_category')
        .annotate(
            total=Count('id'),
            fraud=Count('id', filter=Q(risk_score__gte=t_val) | Q(true_label='FRAUD')),
            volume_inr=Sum('amount_inr'),
        )
        .order_by('-fraud')
    )

    results = []
    for row in cat_stats:
        cat_name = row['merchant_category'] or 'Other'
        tot = row['total'] or 0
        frd = row['fraud'] or 0
        vol = float(row['volume_inr'] or 0.0)
        rate = round((frd / tot * 100.0), 1) if tot > 0 else 0.0
        results.append({
            'category': cat_name,
            'total': tot,
            'fraud': frd,
            'fraudRate': rate,
            'volumeINR': vol,
        })

    return Response(results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stats_risk_distribution(request):
    """
    GET /api/stats/risk-distribution/
    Counts of Approved / Needs review / Likely fraud via database aggregation.
    """
    user = request.user
    base_qs = _get_scoped_transactions(user)

    cfg = ml_service.get_config()
    t_val = cfg['threshold']
    rf_val = cfg['review_floor']

    aggs = base_qs.aggregate(
        approved=Count('id', filter=Q(risk_score__lt=rf_val)),
        needs_review=Count('id', filter=Q(risk_score__gte=rf_val, risk_score__lt=t_val)),
        likely_fraud=Count('id', filter=Q(risk_score__gte=t_val)),
    )

    return Response([
        {'band': 'Approved', 'count': aggs['approved'] or 0, 'color': '#16a34a'},
        {'band': 'Needs review', 'count': aggs['needs_review'] or 0, 'color': '#d97706'},
        {'band': 'Likely fraud', 'count': aggs['likely_fraud'] or 0, 'color': '#dc2626'},
    ])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stats_analyst(request):
    """
    GET /api/stats/analyst/
    Per-analyst case resolution statistics.
    """
    analysts = User.objects.filter(role='analyst')

    cfg = ml_service.get_config()
    rf_val = cfg['review_floor']

    case_stats = (
        Case.objects
        .values('assignee_id')
        .annotate(
            total_cases=Count('id'),
            resolved=Count('id', filter=Q(status__in=['Closed', 'Resolved', 'Confirmed Fraud', 'Confirmed Safe'])),
        )
    )
    stat_map = {row['assignee_id']: row for row in case_stats if row['assignee_id']}

    results = []
    for a in analysts:
        entry = stat_map.get(a.id)
        tot = entry['total_cases'] if entry else 0
        res = entry['resolved'] if entry else 0

        a_cases = Case.objects.filter(assignee=a)
        a_closed = a_cases.filter(closed_at__isnull=False)
        a_total_mins = sum(
            max(0.0, (c.closed_at - c.created_at).total_seconds() / 60.0)
            for c in a_closed if c.closed_at and c.created_at
        )
        a_cnt = a_closed.count()
        a_avg_mins = round(a_total_mins / a_cnt, 1) if a_cnt > 0 else 0.0
        a_avg_hrs = round(a_avg_mins / 60.0, 1)

        results.append({
            'analystId': a.id,
            'analystName': a.name or a.email.split('@')[0],
            'totalCases': tot,
            'resolved': res,
            'avgResolutionHrs': a_avg_hrs,
            'avgReviewMinutes': a_avg_mins,
            'confirmedFraud': a_cases.filter(outcome='fraud').count(),
            'falseAlarms': a_cases.filter(outcome='safe', transaction__risk_score__gte=rf_val).count(),
            'missedFraud': a_cases.filter(outcome='fraud', transaction__risk_score__lt=rf_val).count(),
        })

    return Response(results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stats_merchant(request):
    """
    GET /api/stats/merchant/?limit=6
    Top merchants by fraud rate via database aggregation.
    """
    user = request.user
    limit = int(request.query_params.get('limit', 6))
    base_qs = _get_scoped_transactions(user)

    cfg = ml_service.get_config()
    t_val = cfg['threshold']

    merchant_stats = (
        base_qs
        .values('merchant_name')
        .annotate(
            total=Count('id'),
            fraud=Count('id', filter=Q(risk_score__gte=t_val) | Q(true_label='FRAUD')),
            volume_inr=Sum('amount_inr'),
        )
        .order_by('-fraud')[:limit]
    )

    results = []
    for row in merchant_stats:
        m_name = row['merchant_name'] or 'Merchant'
        tot = row['total'] or 0
        frd = row['fraud'] or 0
        vol = float(row['volume_inr'] or 0.0)
        rate = round((frd / tot * 100.0), 1) if tot > 0 else 0.0
        results.append({
            'merchant': m_name,
            'fraudRate': rate,
            'fraudCount': frd,
            'totalCount': tot,
            'volumeINR': vol,
        })

    return Response(results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stats_customer(request):
    """
    GET /api/stats/customer/
    Customer-specific dashboard metrics.
    """
    user = request.user
    cfg = ml_service.get_config()
    rf_val = cfg['review_floor']

    user_txns = Transaction.objects.filter(card__owner=user)
    aggs = user_txns.aggregate(
        total_spent=Sum('amount_inr'),
        count=Count('id'),
        flagged_count=Count('id', filter=Q(risk_score__gte=rf_val)),
    )

    active_cards = Card.objects.filter(owner=user, status='active').count()
    disputes_count = Dispute.objects.filter(customer=user).count()

    return Response({
        'totalSpentINR': float(aggs['total_spent'] or 0.0),
        'transactionCount': aggs['count'] or 0,
        'activeCardsCount': active_cards,
        'flaggedCount': aggs['flagged_count'] or 0,
        'disputesCount': disputes_count,
    })
