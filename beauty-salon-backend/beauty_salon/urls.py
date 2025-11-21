# beauty_salon/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    UserViewSet,
    ServiceViewSet,
    EmployeeViewSet,
    ClientViewSet,
    ScheduleViewSet,
    TimeOffViewSet,
    AppointmentViewSet,
    NoteViewSet,
    MediaAssetViewSet,
    PaymentViewSet,
    InvoiceViewSet,
    NotificationViewSet,
    ReportPDFViewSet,
    AuditLogViewSet,
    StatsSnapshotViewSet,
    SystemSettingsView,
    StatisticsView,
    DashboardView,
    PopularServicesView,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"services", ServiceViewSet, basename="service")
router.register(r"employees", EmployeeViewSet, basename="employee")
router.register(r"clients", ClientViewSet, basename="client")
router.register(r"schedules", ScheduleViewSet, basename="schedule")
router.register(r"time-offs", TimeOffViewSet, basename="timeoff")
router.register(r"appointments", AppointmentViewSet, basename="appointment")
router.register(r"notes", NoteViewSet, basename="note")
router.register(r"media-assets", MediaAssetViewSet, basename="mediaasset")
router.register(r"payments", PaymentViewSet, basename="payment")
router.register(r"invoices", InvoiceViewSet, basename="invoice")
router.register(r"notifications", NotificationViewSet, basename="notification")
router.register(r"reports", ReportPDFViewSet, basename="reportpdf")
router.register(r"audit-logs", AuditLogViewSet, basename="auditlog")
router.register(r"stats-snapshots", StatsSnapshotViewSet, basename="statssnapshot")

urlpatterns = [
    # wszystkie CRUD-y z routera
    path("", include(router.urls)),

    # widoki specjalne
    path("settings/", SystemSettingsView.as_view(), name="system-settings"),
    path("statistics/", StatisticsView.as_view(), name="statistics"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("popular-services/", PopularServicesView.as_view(), name="popular-services"),

    # logowanie DRF na sesjach Django (przeglądarka)
    path("api-auth/", include("rest_framework.urls")),
]
