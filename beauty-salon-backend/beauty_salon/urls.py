from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .auth_views import csrf, SessionLoginView, SessionLogoutView, AuthStatusView
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

    EmployeeScheduleUpdateView,
    SystemSettingsView,
    StatisticsView,
    DashboardView,
    PopularServicesView,

    AvailabilitySlotsAPIView,
    BookingCreateAPIView,
)

router = DefaultRouter()

router.register(r'users', UserViewSet, basename='user')
router.register(r'services', ServiceViewSet, basename='service')
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'schedules', ScheduleViewSet, basename='schedule')
router.register(r'time-offs', TimeOffViewSet, basename='timeoff')
router.register(r'appointments', AppointmentViewSet, basename='appointment')
router.register(r'notes', NoteViewSet, basename='note')
router.register(r'media', MediaAssetViewSet, basename='media')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'reports', ReportPDFViewSet, basename='report')
router.register(r'audit-logs', AuditLogViewSet, basename='auditlog')
router.register(r'stats-snapshots', StatsSnapshotViewSet, basename='statssnapshot')

urlpatterns = [
    path('auth/csrf/', csrf, name='csrf'),
    path('auth/login/', SessionLoginView.as_view(), name='login'),
    path('auth/logout/', SessionLogoutView.as_view(), name='logout'),
    path('auth/status/', AuthStatusView.as_view(), name='auth-status'),

    path(
        "employees/<int:employee_id>/schedule/",
        EmployeeScheduleUpdateView.as_view(),
        name="employee-schedule-update",
    ),

    path(
        "availability/slots/",
        AvailabilitySlotsAPIView.as_view(),
        name="availability-slots",
    ),

    path("bookings/", BookingCreateAPIView.as_view(), name="booking-create"),

    path('settings/', SystemSettingsView.as_view(), name='system-settings'),

    path('statistics/', StatisticsView.as_view(), name='statistics'),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('popular-services/', PopularServicesView.as_view(), name='popular-services'),

    path('', include(router.urls)),
]
