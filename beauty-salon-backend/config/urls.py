"""
URL configuration for config project.
Projekt: Beauty Salon Management System
"""

from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView

from beauty_salon.admin import admin_site

urlpatterns = [
    # Strona główna → panel admina
    path("", RedirectView.as_view(url="/admin/", permanent=False)),

    # Customowy admin site
    path("admin/", admin_site.urls),

    # Całe API salonu pod /api/
    path("api/", include("beauty_salon.urls")),
]

# W trybie deweloperskim serwuj pliki mediów
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)