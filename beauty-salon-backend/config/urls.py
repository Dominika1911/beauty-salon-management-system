from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView

# ZMIANA: Poprawny import.
# Importujemy 'admin_site' z aplikacji 'beauty_salon', a nie z bieżącego folderu '.'.
from beauty_salon.admin import admin_site

urlpatterns = [
    path("", RedirectView.as_view(url="/admin/", permanent=False)),  # Przekierowanie ze strony głównej

    # Używamy zaimportowanego 'admin_site.urls'
    path("admin/", admin_site.urls),
]

# Pliki uploadowane (tylko w dev)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)