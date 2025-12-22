from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .auth_views import csrf, SessionLoginView, SessionLogoutView, AuthStatusView
from .views import (
    # CRUD (router)
    UserViewSet,
    ServiceViewSet,
    EmployeeViewSet,
    ClientViewSet,
    AppointmentViewSet,
    AuditLogViewSet,

    # Endpointy MVP
    SystemSettingsView,
    StatisticsView,

    # Logika biznesowa
    AvailabilitySlotsAPIView,
    BookingCreateAPIView,
    CheckAvailabilityView,

    # Nowe: Dashboard i raporty
    DashboardView,
    RevenueReportView,
    EmployeePerformanceView,
    PopularServicesView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'services', ServiceViewSet, basename='service')
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'appointments', AppointmentViewSet, basename='appointment')
router.register(r'audit-logs', AuditLogViewSet, basename='auditlog')

urlpatterns = [
    # Auth (Session + CSRF)
    path('auth/csrf/', csrf, name='csrf'),
    path('auth/login/', SessionLoginView.as_view(), name='login'),
    path('auth/logout/', SessionLogoutView.as_view(), name='logout'),
    path('auth/status/', AuthStatusView.as_view(), name='auth-status'),

    # CRUD
    path('', include(router.urls)),

    # Ustawienia + statystyki (wymagania pracy)
    path('system-settings/', SystemSettingsView.as_view(), name='system-settings'),
    path('statistics/', StatisticsView.as_view(), name='statistics'),

    # Dashboard - zróżnicowany dla każdej roli
    path('dashboard/', DashboardView.as_view(), name='dashboard'),

    # Dostępność + rezerwacje
    path('availability/slots/', AvailabilitySlotsAPIView.as_view(), name='availability-slots'),
    path('appointments/book/', BookingCreateAPIView.as_view(), name='appointment-book'),
    path('appointments/check-availability/', CheckAvailabilityView.as_view(), name='check-availability'),

    # Zaawansowane raporty
    path('reports/revenue/', RevenueReportView.as_view(), name='revenue-report'),
    path('reports/employee-performance/', EmployeePerformanceView.as_view(), name='employee-performance'),
    path('reports/popular-services/', PopularServicesView.as_view(), name='popular-services'),
]