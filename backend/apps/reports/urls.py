from django.urls import path
from apps.reports.views import ReportBuilderView

urlpatterns = [
    path('reports/', ReportBuilderView.as_view(), name='report_builder'),
]
