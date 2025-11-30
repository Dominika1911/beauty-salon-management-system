from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    # User & Auth
    UserViewSet,

    # Services
    ServiceViewSet,

    # Employees
    EmployeeViewSet,

    # Clients
    ClientViewSet,

    # Schedule & TimeOff
    ScheduleViewSet,
    TimeOffViewSet,

    # Appointments
    AppointmentViewSet,

    # Notes & Media
    NoteViewSet,
    MediaAssetViewSet,

    # Payments & Invoices
    PaymentViewSet,
    InvoiceViewSet,

    # Notifications & Reports
    NotificationViewSet,
    ReportPDFViewSet,

    # Audit & System
    AuditLogViewSet,
    SystemSettingsView,
    StatsSnapshotViewSet,

    # Statistics & Dashboard
    StatisticsView,
    DashboardView,
    PopularServicesView,
)

# ✅ Importy widoków auth
from .auth_views import (
    csrf,
    SessionLoginView,
    SessionLogoutView,
    AuthStatusView,
)

# =====================================================================
# ROUTER DLA VIEWSETS
# =====================================================================

router = DefaultRouter()

# User Management
router.register(r'users', UserViewSet, basename='user')

# Services
router.register(r'services', ServiceViewSet, basename='service')

# Employees
router.register(r'employees', EmployeeViewSet, basename='employee')

# Clients
router.register(r'clients', ClientViewSet, basename='client')

# Schedule & TimeOff
router.register(r'schedules', ScheduleViewSet, basename='schedule')
router.register(r'time-offs', TimeOffViewSet, basename='timeoff')

# Appointments
router.register(r'appointments', AppointmentViewSet, basename='appointment')

# Notes & Media
router.register(r'notes', NoteViewSet, basename='note')
router.register(r'media', MediaAssetViewSet, basename='media')

# Payments & Invoices
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'invoices', InvoiceViewSet, basename='invoice')

# Notifications & Reports
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'reports', ReportPDFViewSet, basename='report')

# Audit & Stats
router.register(r'audit-logs', AuditLogViewSet, basename='auditlog')
router.register(r'stats-snapshots', StatsSnapshotViewSet, basename='statssnapshot')

# =====================================================================
# URL PATTERNS
# =====================================================================

urlpatterns = [
    # ✅ AUTHENTICATION ENDPOINTS
    path('auth/csrf/', csrf, name='csrf'),
    path('auth/login/', SessionLoginView.as_view(), name='login'),
    path('auth/logout/', SessionLogoutView.as_view(), name='logout'),
    path('auth/status/', AuthStatusView.as_view(), name='auth-status'),

    # SYSTEM SETTINGS (nie jest ViewSet)
    path('settings/', SystemSettingsView.as_view(), name='system-settings'),

    # STATISTICS & DASHBOARD
    path('statistics/', StatisticsView.as_view(), name='statistics'),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('popular-services/', PopularServicesView.as_view(), name='popular-services'),

    # ROUTER - wszystkie ViewSets
    path('', include(router.urls)),
]