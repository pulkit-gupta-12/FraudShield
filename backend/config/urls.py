from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from apps.accounts.views import HealthCheckView

urlpatterns = [
    path('admin/', admin.site.urls),

    # Health check
    path('api/health/', HealthCheckView.as_view(), name='api_health'),
    path('health/', HealthCheckView.as_view(), name='root_health'),

    # API endpoints
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.audit.urls')),
    path('api/', include('apps.fraud.urls')),
    path('api/', include('apps.ml.urls')),
    path('api/', include('apps.stats.urls')),

    # Root mirror fallback for convenience
    path('', include('apps.accounts.urls')),
    path('', include('apps.audit.urls')),
    path('', include('apps.fraud.urls')),
    path('', include('apps.ml.urls')),
    path('', include('apps.stats.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
