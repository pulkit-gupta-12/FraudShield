from django.urls import path
from apps.stats.views import (
    stats_overview,
    stats_timeseries,
    stats_by_hour,
    stats_by_category,
    stats_risk_distribution,
    stats_analyst,
    stats_merchant,
    stats_customer,
)

urlpatterns = [
    path('stats/overview/', stats_overview, name='stats_overview'),
    path('stats/timeseries/', stats_timeseries, name='stats_timeseries'),
    path('stats/by-hour/', stats_by_hour, name='stats_by_hour'),
    path('stats/by-category/', stats_by_category, name='stats_by_category'),
    path('stats/risk-distribution/', stats_risk_distribution, name='stats_risk_distribution'),
    path('stats/analyst/', stats_analyst, name='stats_analyst'),
    path('stats/merchant/', stats_merchant, name='stats_merchant'),
    path('stats/customer/', stats_customer, name='stats_customer'),
]
