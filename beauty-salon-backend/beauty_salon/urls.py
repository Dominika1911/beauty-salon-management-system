from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .auth_views import csrf, SessionLoginView, SessionLogoutView, AuthStatusView
from .views import (
    UserViewSet,
    ServiceViewSet,
    EmployeeViewSet,
    ClientViewSet,
    AppointmentViewSet,
    AuditLogViewSet,
    TimeOffViewSet,
    SystemSettingsView,
    StatisticsView,
    AvailabilitySlotsAPIView,
    BookingCreateAPIView,
    CheckAvailabilityView,
    DashboardView,
    ReportView,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"services", ServiceViewSet, basename="service")
router.register(r"employees", EmployeeViewSet, basename="employee")
router.register(r"clients", ClientViewSet, basename="client")
router.register(r"appointments", AppointmentViewSet, basename="appointment")
router.register(r"audit-logs", AuditLogViewSet, basename="auditlog")
router.register(r"time-offs", TimeOffViewSet, basename="timeoff")

urlpatterns = [
    # Auth (Session + CSRF)
    path("auth/csrf/", csrf, name="csrf"),
    path("auth/login/", SessionLoginView.as_view(), name="login"),
    path("auth/logout/", SessionLogoutView.as_view(), name="logout"),
    path("auth/status/", AuthStatusView.as_view(), name="auth-status"),

    # Dostępność + rezerwacje
    path("availability/slots/", AvailabilitySlotsAPIView.as_view(), name="availability-slots"),
    path("appointments/book/", BookingCreateAPIView.as_view(), name="appointment-book"),
    path("appointments/check-availability/", CheckAvailabilityView.as_view(), name="check-availability"),

    # Ustawienia + statystyki
    path("system-settings/", SystemSettingsView.as_view(), name="system-settings"),
    path("statistics/", StatisticsView.as_view(), name="statistics"),

    # Dashboard
    path("dashboard/", DashboardView.as_view(), name="dashboard"),

    # Raporty
    path("reports/", ReportView.as_view(), name="reports-list"),
    path("reports/<str:report_type>/", ReportView.as_view(), name="report-json"),
    path("reports/<str:report_type>/pdf/", ReportView.as_view(), name="report-pdf"),

    # CRUD - ROUTER NA KOŃCU
    path("", include(router.urls)),
]
