from __future__ import annotations

import io
import os
from datetime import datetime, timedelta, time
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from django.db import transaction
from django.db.models import Count, Sum, Q
from django.db.models.functions import Coalesce, TruncDate, TruncMonth
from django.http import HttpResponse
from django.utils import timezone

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets, permissions, serializers, filters
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

# PDF (ReportLab)
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping

from .models import (
    Service,
    EmployeeProfile,
    ClientProfile,
    EmployeeSchedule,
    TimeOff,
    Appointment,
    SystemSettings,
    SystemLog,
)
from .serializers import (
    UserListSerializer,
    UserDetailSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    ServiceSerializer,
    EmployeeSerializer,
    ClientSerializer,
    AppointmentSerializer,
    SystemSettingsSerializer,
    SystemLogSerializer,
    BookingCreateSerializer,
    EmployeeScheduleSerializer,
    TimeOffSerializer,
)
from .permissions import IsAdmin, IsAdminOrEmployee, IsEmployee, CanCancelAppointment

User = get_user_model()

# =============================================================================
# PDF FONT (DejaVuSans) - polskie znaki
# =============================================================================
FONT_PATH = os.path.join(settings.BASE_DIR, "static", "fonts", "DejaVuSans.ttf")
PDF_FONT_NAME = "DejaVuSans"

try:
    if os.path.exists(FONT_PATH):
        pdfmetrics.registerFont(TTFont(PDF_FONT_NAME, FONT_PATH))
        addMapping(PDF_FONT_NAME, 0, 0, PDF_FONT_NAME)
    else:
        PDF_FONT_NAME = "Helvetica"
except Exception:
    PDF_FONT_NAME = "Helvetica"


def clean_text(s):
    if s is None:
        return ""
    return str(s).replace("\u00a0", " ").replace("\u200b", "")


# =============================================================================
# USERS
# =============================================================================

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["role", "is_active"]
    search_fields = ["username", "first_name", "last_name", "email"]
    ordering_fields = ["id", "username", "role", "date_joined"]

    def get_permissions(self):
        if self.action == "me":
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]

    def get_serializer_class(self):
        if self.action == "list":
            return UserListSerializer
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ["update", "partial_update"]:
            return UserUpdateSerializer
        return UserDetailSerializer

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        return Response(UserDetailSerializer(request.user, context={"request": request}).data)


# =============================================================================
# SERVICES
# =============================================================================

class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active", "category"]
    search_fields = ["name", "category", "description"]
    ordering_fields = ["id", "name", "price", "duration_minutes", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not (user and user.is_authenticated) or getattr(user, "role", None) == User.Role.CLIENT:
            return qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "disable", "enable"]:
            return [IsAdminOrEmployee()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        obj = serializer.save()
        SystemLog.log(
            action=SystemLog.Action.SERVICE_CREATED,
            performed_by=self.request.user,
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        SystemLog.log(
            action=SystemLog.Action.SERVICE_UPDATED,
            performed_by=self.request.user,
        )

    @action(detail=True, methods=["post"], url_path="disable")
    def disable(self, request, pk=None):
        obj = self.get_object()
        obj.is_active = False
        obj.save(update_fields=["is_active"])
        SystemLog.log(action=SystemLog.Action.SERVICE_DISABLED, performed_by=request.user)
        return Response({"detail": "Usługa została wyłączona."})

    @action(detail=True, methods=["post"], url_path="enable")
    def enable(self, request, pk=None):
        obj = self.get_object()
        obj.is_active = True
        obj.save(update_fields=["is_active"])
        SystemLog.log(action=SystemLog.Action.SERVICE_ENABLED, performed_by=request.user)
        return Response({"detail": "Usługa została włączona."})


# =============================================================================
# EMPLOYEES
# =============================================================================

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = EmployeeProfile.objects.all().prefetch_related("skills")
    serializer_class = EmployeeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active", "employee_number"]
    search_fields = ["employee_number", "first_name", "last_name"]
    ordering_fields = ["id", "employee_number", "last_name", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()

        qs = qs.annotate(
            appointments_count=Count("appointments", distinct=True),
            completed_appointments_count=Count(
                "appointments",
                filter=Q(appointments__status=Appointment.Status.COMPLETED),
                distinct=True,
            ),
            revenue_completed_total=Coalesce(
                Sum(
                    "appointments__service__price",
                    filter=Q(appointments__status=Appointment.Status.COMPLETED),
                ),
                Decimal("0.00"),
            ),
        )

        user = self.request.user
        if not (user and user.is_authenticated) or getattr(user, "role", None) == User.Role.CLIENT:
            return qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        # schedule: GET -> admin/employee, PATCH/PUT -> tylko admin
        if self.action == "schedule":
            if self.request.method in ["PATCH", "PUT"]:
                return [IsAdmin()]
            return [IsAdminOrEmployee()]

        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAdminOrEmployee()]

        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        obj = serializer.save()
        SystemLog.log(
            action=SystemLog.Action.EMPLOYEE_CREATED,
            performed_by=self.request.user,
            target_user=getattr(obj, "user", None),
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        SystemLog.log(
            action=SystemLog.Action.EMPLOYEE_UPDATED,
            performed_by=self.request.user,
            target_user=getattr(obj, "user", None),
        )

    @action(detail=True, methods=["get", "patch"], url_path="schedule")
    def schedule(self, request, pk=None):
        employee = self.get_object()
        schedule, _ = EmployeeSchedule.objects.get_or_create(employee=employee)

        if request.method == "GET":
            return Response(EmployeeScheduleSerializer(schedule, context={"request": request}).data)

        ser = EmployeeScheduleSerializer(
            schedule,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save()

        # Bonus: log zmiany grafiku jako EMPLOYEE_UPDATED
        SystemLog.log(
            action=SystemLog.Action.EMPLOYEE_UPDATED,
            performed_by=request.user,
            target_user=getattr(employee, "user", None),
        )

        return Response(ser.data)

# =============================================================================
# TIME OFF (SPÓJNY ENDPOINT)
# =============================================================================

class TimeOffViewSet(viewsets.ModelViewSet):
    """
    - EMPLOYEE: list/retrieve swoich + create dla siebie (PENDING)
    - ADMIN: list/retrieve wszystkich + create dla dowolnego + approve/reject
    """
    serializer_class = TimeOffSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ["status", "employee"]
    ordering_fields = ["created_at", "date_from", "date_to", "status"]
    search_fields = ["reason", "employee__first_name", "employee__last_name"]

    def get_permissions(self):
        if self.action in ["approve", "reject", "update", "partial_update", "destroy"]:
            return [IsAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = (
            TimeOff.objects
            .select_related("employee", "employee__user", "requested_by", "decided_by")
            .order_by("-created_at")
        )

        user = self.request.user
        role = getattr(user, "role", None)

        if not user.is_authenticated or role == User.Role.CLIENT:
            return qs.none()

        if role == User.Role.EMPLOYEE:
            emp = getattr(user, "employee_profile", None)
            if not emp:
                return qs.none()
            qs = qs.filter(employee=emp)

        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if date_from:
            try:
                df = datetime.strptime(date_from, "%Y-%m-%d").date()
                qs = qs.filter(date_to__gte=df)
            except Exception:
                pass

        if date_to:
            try:
                dt = datetime.strptime(date_to, "%Y-%m-%d").date()
                qs = qs.filter(date_from__lte=dt)
            except Exception:
                pass

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        role = getattr(user, "role", None)

        if role == User.Role.EMPLOYEE:
            emp = getattr(user, "employee_profile", None)
            if not emp:
                raise PermissionDenied("Brak profilu pracownika.")
            obj = serializer.save(employee=emp, status=TimeOff.Status.PENDING, requested_by=user)

        elif role == User.Role.ADMIN or user.is_staff:
            employee = serializer.validated_data.get("employee")
            if not employee:
                raise serializers.ValidationError({"employee": "Pole employee jest wymagane dla ADMIN."})
            obj = serializer.save(status=TimeOff.Status.PENDING, requested_by=user)

        else:
            raise PermissionDenied("Brak uprawnień.")

        SystemLog.log(
            action=SystemLog.Action.TIMEOFF_CREATED,
            performed_by=user,
            target_user=getattr(obj.employee, "user", None),
        )

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        obj: TimeOff = self.get_object()

        if obj.status != TimeOff.Status.PENDING:
            return Response({"detail": "Można akceptować tylko wnioski PENDING."}, status=status.HTTP_400_BAD_REQUEST)

        obj.status = TimeOff.Status.APPROVED
        obj.decided_by = request.user
        obj.decided_at = timezone.now()
        obj.save(update_fields=["status", "decided_by", "decided_at"])

        SystemLog.log(
            action=SystemLog.Action.TIMEOFF_APPROVED,
            performed_by=request.user,
            target_user=getattr(obj.employee, "user", None),
        )
        return Response(TimeOffSerializer(obj, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        obj: TimeOff = self.get_object()

        if obj.status != TimeOff.Status.PENDING:
            return Response({"detail": "Można odrzucać tylko wnioski PENDING."}, status=status.HTTP_400_BAD_REQUEST)

        obj.status = TimeOff.Status.REJECTED
        obj.decided_by = request.user
        obj.decided_at = timezone.now()
        obj.save(update_fields=["status", "decided_by", "decided_at"])

        SystemLog.log(
            action=SystemLog.Action.TIMEOFF_REJECTED,
            performed_by=request.user,
            target_user=getattr(obj.employee, "user", None),
        )
        return Response(TimeOffSerializer(obj, context={"request": request}).data)


# =============================================================================
# CLIENTS
# =============================================================================

class ClientViewSet(viewsets.ModelViewSet):
    queryset = ClientProfile.objects.all()
    serializer_class = ClientSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active", "client_number"]
    search_fields = ["client_number", "first_name", "last_name", "email", "phone"]
    ordering_fields = ["id", "client_number", "last_name", "created_at"]

    def get_queryset(self):
        return super().get_queryset().annotate(appointments_count=Count("appointments", distinct=True))

    def get_permissions(self):
        if self.action == "me":
            return [permissions.IsAuthenticated()]
        return [IsAdminOrEmployee()]

    def perform_create(self, serializer):
        obj = serializer.save()
        SystemLog.log(
            action=SystemLog.Action.CLIENT_CREATED,
            performed_by=self.request.user,
            target_user=getattr(obj, "user", None),
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        SystemLog.log(
            action=SystemLog.Action.CLIENT_UPDATED,
            performed_by=self.request.user,
            target_user=getattr(obj, "user", None),
        )

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        profile = getattr(request.user, "client_profile", None)
        if not profile:
            return Response(
                {"detail": "Brak profilu klienta dla tego konta."},
                status=status.HTTP_404_NOT_FOUND,
            )

        obj = self.get_queryset().filter(pk=profile.pk).first()
        return Response(ClientSerializer(obj, context={"request": request}).data)

# =============================================================================
# APPOINTMENTS
# =============================================================================

class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.select_related("client", "employee", "service").all()
    serializer_class = AppointmentSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status", "employee", "service", "client"]
    ordering_fields = ["start", "status", "created_at"]

    def get_permissions(self):
        """
        Minimalnie i jasno:
        - confirm/complete: ADMIN/EMPLOYEE
        - cancel: specyficzna logika (np. klient może anulować swoje)
        - my: EMPLOYEE
        - list/retrieve: zalogowany (bo i tak filtrujemy queryset do "swoich")
        - reszta (create/update/destroy): ADMIN/EMPLOYEE
        """
        if self.action in ["confirm", "complete"]:
            return [IsAdminOrEmployee()]

        if self.action == "cancel":
            return [CanCancelAppointment()]

        if self.action == "my":
            return [IsEmployee()]

        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated()]

        return [IsAdminOrEmployee()]

    def get_queryset(self):
        """
        Kluczowe zabezpieczenie:
        - CLIENT: tylko swoje wizyty
        - EMPLOYEE: tylko swoje wizyty
        - ADMIN: wszystko
        """
        qs = super().get_queryset()
        user = self.request.user

        if not (user and user.is_authenticated):
            return qs.none()

        role = getattr(user, "role", None)

        if role == User.Role.CLIENT:
            profile = getattr(user, "client_profile", None)
            return qs.filter(client=profile) if profile else qs.none()

        if role == User.Role.EMPLOYEE:
            employee = getattr(user, "employee_profile", None)
            return qs.filter(employee=employee) if employee else qs.none()

        return qs  # ADMIN

    def perform_create(self, serializer):
        obj = serializer.save()
        SystemLog.log(
            action=SystemLog.Action.APPOINTMENT_CREATED,
            performed_by=self.request.user,
            target_user=getattr(getattr(obj, "client", None), "user", None),
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        # nie dubluj logów w confirm/cancel/complete
        if self.action in ["update", "partial_update"]:
            SystemLog.log(
                action=SystemLog.Action.APPOINTMENT_UPDATED,
                performed_by=self.request.user,
                target_user=getattr(getattr(obj, "client", None), "user", None),
            )

    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request):
        """
        Endpoint dla EMPLOYEE: lista jego wizyt.
        Paginacja: używa globalnej PageNumberPagination + PAGE_SIZE.
        """
        employee = getattr(request.user, "employee_profile", None)
        if not employee:
            return Response({"detail": "Brak profilu pracownika."}, status=status.HTTP_404_NOT_FOUND)

        qs = (
            Appointment.objects
            .select_related("client", "employee", "service")
            .filter(employee=employee)
            .order_by("start")
        )

        page = self.paginate_queryset(qs)
        if page is not None:
            ser = AppointmentSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(ser.data)

        return Response(AppointmentSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="confirm")
    @transaction.atomic
    def confirm(self, request, pk=None):
        # row-lock: brak lost update
        appt = (
            Appointment.objects
            .select_for_update()
            .select_related("client", "client__user", "employee", "service")
            .get(pk=pk)
        )
        self.check_object_permissions(request, appt)

        if appt.status != Appointment.Status.PENDING:
            return Response(
                {"detail": "Można potwierdzić tylko wizyty w statusie PENDING."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        appt.status = Appointment.Status.CONFIRMED
        appt.save(update_fields=["status"])

        SystemLog.log(
            action=SystemLog.Action.APPOINTMENT_CONFIRMED,
            performed_by=request.user,
            target_user=getattr(getattr(appt, "client", None), "user", None),
        )

        return Response(AppointmentSerializer(appt, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    @transaction.atomic
    def cancel(self, request, pk=None):
        appt = (
            Appointment.objects
            .select_for_update()
            .select_related("client", "client__user", "employee", "service")
            .get(pk=pk)
        )
        self.check_object_permissions(request, appt)

        if appt.status == Appointment.Status.CANCELLED:
            return Response({"detail": "Wizyta jest już anulowana."}, status=status.HTTP_400_BAD_REQUEST)

        if appt.status == Appointment.Status.COMPLETED:
            return Response({"detail": "Nie można anulować zakończonej wizyty."}, status=status.HTTP_400_BAD_REQUEST)

        if appt.status not in [Appointment.Status.PENDING, Appointment.Status.CONFIRMED]:
            return Response({"detail": "Nie można anulować wizyty w tym statusie."}, status=status.HTTP_400_BAD_REQUEST)

        appt.status = Appointment.Status.CANCELLED
        appt.internal_notes = (appt.internal_notes or "") + (
            f"\n[ANULOWANO {timezone.now():%Y-%m-%d %H:%M}] przez {request.user.username}"
        )
        appt.save(update_fields=["status", "internal_notes"])

        SystemLog.log(
            action=SystemLog.Action.APPOINTMENT_CANCELLED,
            performed_by=request.user,
            target_user=getattr(getattr(appt, "client", None), "user", None),
        )

        return Response(AppointmentSerializer(appt, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="complete")
    @transaction.atomic
    def complete(self, request, pk=None):
        appt = (
            Appointment.objects
            .select_for_update()
            .select_related("client", "client__user", "employee", "service")
            .get(pk=pk)
        )
        self.check_object_permissions(request, appt)

        if appt.status not in [Appointment.Status.PENDING, Appointment.Status.CONFIRMED]:
            return Response(
                {"detail": "Można zakończyć tylko wizyty potwierdzone lub oczekujące."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        appt.status = Appointment.Status.COMPLETED
        appt.save(update_fields=["status"])

        SystemLog.log(
            action=SystemLog.Action.APPOINTMENT_COMPLETED,
            performed_by=request.user,
            target_user=getattr(getattr(appt, "client", None), "user", None),
        )

        return Response(AppointmentSerializer(appt, context={"request": request}).data)


# =============================================================================
# AUDIT LOG
# =============================================================================

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SystemLog.objects.select_related("performed_by", "target_user").all()
    serializer_class = SystemLogSerializer
    permission_classes = [IsAdmin]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["action", "performed_by", "target_user"]
    ordering_fields = ["timestamp"]


# =============================================================================
# SYSTEM SETTINGS
# =============================================================================

class SystemSettingsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        obj = SystemSettings.get_settings()
        return Response(SystemSettingsSerializer(obj, context={"request": request}).data)

    def patch(self, request):
        obj = SystemSettings.get_settings()
        ser = SystemSettingsSerializer(obj, data=request.data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save(updated_by=request.user)
        SystemLog.log(action=SystemLog.Action.SETTINGS_UPDATED, performed_by=request.user)
        return Response(ser.data)


# =============================================================================
# STATISTICS
# =============================================================================

class StatisticsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        now = timezone.now()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if date_from and date_to:
            try:
                start_date = datetime.strptime(date_from, "%Y-%m-%d").date()
                end_date = datetime.strptime(date_to, "%Y-%m-%d").date()
            except Exception:
                return Response({"detail": "Nieprawidłowy format daty. Użyj YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

            since = timezone.make_aware(datetime.combine(start_date, time(0, 0)))
            until = timezone.make_aware(datetime.combine(end_date, time(23, 59, 59)))
        else:
            since = now - timedelta(days=30)
            until = now

        base = Appointment.objects.filter(start__gte=since, start__lte=until)

        total = Appointment.objects.count()
        period_count = base.count()
        by_status = base.values("status").annotate(count=Count("id")).order_by("status")

        top_services = (
            base.values("service__id", "service__name")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )
        top_employees = (
            base.values("employee__id", "employee__employee_number")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )

        revenue = (
            base.filter(status=Appointment.Status.COMPLETED)
            .aggregate(total=Sum("service__price"))["total"]
            or 0
        )

        return Response({
            "range": {"from": since.date().isoformat(), "to": until.date().isoformat()},
            "appointments": {
                "total_all_time": total,
                "count_in_range": period_count,
                "by_status": list(by_status),
                "revenue_completed_in_range": float(revenue),
            },
            "top_services_in_range": list(top_services),
            "top_employees_in_range": list(top_employees),
        })


# =============================================================================
# Availability + Booking
# =============================================================================

def _parse_date(date_str: str):
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def _parse_hhmm(hhmm: str) -> time:
    return datetime.strptime(hhmm, "%H:%M").time()


def _weekday_key(d) -> str:
    return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][d.weekday()]


class AvailabilitySlotsAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        employee_id = request.query_params.get("employee_id")
        service_id = request.query_params.get("service_id")
        date_str = request.query_params.get("date")

        if not employee_id or not service_id or not date_str:
            return Response(
                {"detail": "Wymagane parametry: employee_id, service_id, date (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            employee = EmployeeProfile.objects.get(pk=int(employee_id), is_active=True)
        except Exception:
            return Response({"detail": "Nie znaleziono pracownika."}, status=status.HTTP_404_NOT_FOUND)

        try:
            service = Service.objects.get(pk=int(service_id), is_active=True)
        except Exception:
            return Response({"detail": "Nie znaleziono usługi."}, status=status.HTTP_404_NOT_FOUND)

        try:
            day = _parse_date(date_str)
        except Exception:
            return Response({"detail": "Nieprawidłowy format daty. Użyj YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.now().date()
        if day < today:
            return Response({"detail": "Nie można rezerwować wizyt w przeszłości."}, status=status.HTTP_400_BAD_REQUEST)

        if TimeOff.objects.filter(
            employee=employee,
            status=TimeOff.Status.APPROVED,
            date_from__lte=day,
            date_to__gte=day
        ).exists():
            return Response({"date": date_str, "slots": []})

        schedule = getattr(employee, "schedule", None)
        if not schedule:
            return Response({"date": date_str, "slots": []})

        periods = (schedule.weekly_hours or {}).get(_weekday_key(day), [])
        if not periods:
            return Response({"date": date_str, "slots": []})

        settings_obj = SystemSettings.get_settings()
        slot_minutes = int(settings_obj.slot_minutes)
        buffer_minutes = int(settings_obj.buffer_minutes)
        duration = timedelta(minutes=int(service.duration_minutes) + int(buffer_minutes))

        day_start = timezone.make_aware(datetime.combine(day, time(0, 0)))
        day_end = timezone.make_aware(datetime.combine(day, time(23, 59, 59)))

        busy = list(
            Appointment.objects
            .filter(employee=employee, start__lt=day_end, end__gt=day_start,
                    status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED])
            .values_list("start", "end")
        )

        slots: list[dict] = []
        for p in periods:
            try:
                p_start = timezone.make_aware(datetime.combine(day, _parse_hhmm(p.get("start", ""))))
                p_end = timezone.make_aware(datetime.combine(day, _parse_hhmm(p.get("end", ""))))
            except Exception:
                return Response({"detail": "Błędne dane grafiku pracownika."}, status=status.HTTP_400_BAD_REQUEST)

            cursor = p_start
            while cursor + duration <= p_end:
                candidate_start = cursor
                candidate_end = cursor + duration

                if candidate_start < timezone.now():
                    cursor += timedelta(minutes=slot_minutes)
                    continue

                overlap = any(b_start < candidate_end and b_end > candidate_start for b_start, b_end in busy)
                if not overlap:
                    slots.append({"start": candidate_start.isoformat(), "end": candidate_end.isoformat()})

                cursor += timedelta(minutes=slot_minutes)

        return Response({"date": date_str, "slots": slots})


class BookingCreateAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        ser = BookingCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        appointment = ser.save()

        SystemLog.log(action=SystemLog.Action.APPOINTMENT_CREATED, performed_by=request.user)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data, status=status.HTTP_201_CREATED)


class CheckAvailabilityView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        employee_id = request.data.get("employee_id")
        service_id = request.data.get("service_id")
        start_str = request.data.get("start")

        if not all([employee_id, service_id, start_str]):
            return Response({"detail": "Wymagane pola: employee_id, service_id, start (ISO format)"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = EmployeeProfile.objects.get(pk=int(employee_id), is_active=True)
        except Exception:
            return Response({"available": False, "reason": "Nie znaleziono pracownika."}, status=status.HTTP_404_NOT_FOUND)

        try:
            service = Service.objects.get(pk=int(service_id), is_active=True)
        except Exception:
            return Response({"available": False, "reason": "Nie znaleziono usługi."}, status=status.HTTP_404_NOT_FOUND)

        try:
            start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            if timezone.is_naive(start):
                start = timezone.make_aware(start)
        except Exception:
            return Response({"available": False, "reason": "Nieprawidłowy format daty. Użyj ISO format."}, status=status.HTTP_400_BAD_REQUEST)

        if TimeOff.objects.filter(
            employee=employee,
            status=TimeOff.Status.APPROVED,
            date_from__lte=start.date(),
            date_to__gte=start.date()
        ).exists():
            return Response({"available": False, "reason": "Pracownik jest nieobecny w tym dniu."})

        settings_obj = SystemSettings.get_settings()
        buffer_minutes = int(settings_obj.buffer_minutes)
        duration = timedelta(minutes=int(service.duration_minutes) + int(buffer_minutes))
        end = start + duration

        conflicts = (
            Appointment.objects
            .filter(employee=employee, start__lt=end, end__gt=start,
                    status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED])
        )

        if conflicts.exists():
            return Response({"available": False, "reason": "Pracownik ma już zarezerwowaną wizytę w tym czasie."})

        return Response({
            "available": True,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "duration_minutes": service.duration_minutes + buffer_minutes,
        })


# =============================================================================
# Dashboard
# =============================================================================

class DashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        if getattr(user, "is_admin_role", False):
            return self._admin_dashboard(request)
        if getattr(user, "is_employee", False):
            return self._employee_dashboard(request, user)
        if getattr(user, "is_client", False):
            return self._client_dashboard(request, user)

        return Response({"detail": "Brak uprawnień"}, status=status.HTTP_403_FORBIDDEN)

    def _admin_dashboard(self, request):
        today = timezone.now().date()
        now = timezone.now()

        today_appointments = Appointment.objects.filter(start__date=today)
        pending_count = Appointment.objects.filter(status=Appointment.Status.PENDING).count()

        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_revenue = (
            Appointment.objects.filter(
                status=Appointment.Status.COMPLETED,
                start__gte=month_start
            ).aggregate(total=Sum("service__price"))["total"] or Decimal("0")
        )

        active_employees = EmployeeProfile.objects.filter(is_active=True).count()
        active_clients = ClientProfile.objects.filter(is_active=True).count()

        return Response({
            "role": "ADMIN",
            "today": {
                "date": today.isoformat(),
                "appointments_count": today_appointments.count(),
                "appointments": AppointmentSerializer(today_appointments.order_by("start")[:10], many=True, context={"request": request}).data,
            },
            "pending_appointments": pending_count,
            "current_month": {
                "revenue": float(month_revenue),
                "completed_appointments": Appointment.objects.filter(
                    status=Appointment.Status.COMPLETED,
                    start__gte=month_start
                ).count(),
            },
            "system": {
                "active_employees": active_employees,
                "active_clients": active_clients,
                "active_services": Service.objects.filter(is_active=True).count(),
            }
        })

    def _employee_dashboard(self, request, user):
        employee = getattr(user, "employee_profile", None)
        if not employee:
            return Response({"detail": "Brak profilu pracownika."}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.now()
        today_date = today.date()

        today_schedule = Appointment.objects.filter(
            employee=employee,
            start__date=today_date,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED]
        ).order_by("start")

        week_later = today + timedelta(days=7)
        upcoming = Appointment.objects.filter(
            employee=employee,
            start__gte=today,
            start__lte=week_later,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED]
        ).order_by("start")

        month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_completed = Appointment.objects.filter(
            employee=employee,
            status=Appointment.Status.COMPLETED,
            start__gte=month_start
        ).count()

        return Response({
            "role": "EMPLOYEE",
            "employee_number": employee.employee_number,
            "full_name": employee.get_full_name(),
            "today": {
                "date": today_date.isoformat(),
                "appointments": AppointmentSerializer(today_schedule, many=True, context={"request": request}).data,
            },
            "upcoming": {
                "count": upcoming.count(),
                "appointments": AppointmentSerializer(upcoming[:5], many=True, context={"request": request}).data,
            },
            "this_month": {
                "completed_appointments": month_completed,
            }
        })

    def _client_dashboard(self, request, user):
        client = getattr(user, "client_profile", None)
        if not client:
            return Response({"detail": "Brak profilu klienta."}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()

        upcoming = Appointment.objects.filter(
            client=client,
            start__gte=now,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED]
        ).order_by("start")

        history_count = Appointment.objects.filter(client=client, status=Appointment.Status.COMPLETED).count()

        recent_history = Appointment.objects.filter(
            client=client,
            status=Appointment.Status.COMPLETED
        ).order_by("-start")[:3]

        return Response({
            "role": "CLIENT",
            "client_number": client.client_number,
            "full_name": client.get_full_name(),
            "upcoming_appointments": {
                "count": upcoming.count(),
                "appointments": AppointmentSerializer(upcoming[:5], many=True, context={"request": request}).data,
            },
            "history": {
                "total_completed": history_count,
                "recent": AppointmentSerializer(recent_history, many=True, context={"request": request}).data,
            }
        })


# =============================================================================
# PDF REPORTS ENGINE
# =============================================================================

class ReportView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, *args, **kwargs):
        report_type = kwargs.get("report_type")

        if report_type is None:
            return Response({
                "available_reports": [
                    {"type": "employees", "description": "Lista pracowników"},
                    {"type": "clients", "description": "Baza klientów"},
                    {"type": "today", "description": "Grafik na dziś"},
                    {"type": "revenue", "description": "Raport finansowy"},
                ]
            })

        if report_type == "revenue":
            if "pdf" in request.path or request.query_params.get("format") == "pdf":
                return self._revenue_pdf_report(request)
            return self._revenue_json_report(request)

        if report_type == "employees":
            return self._employees_report()
        if report_type == "clients":
            return self._clients_report()
        if report_type == "today":
            return self._today_appointments_report()

        return Response({"error": "Nieznany typ raportu."}, status=status.HTTP_400_BAD_REQUEST)

    def _build_pdf_response(self, title_text, data, filename, landscape_mode=False):
        buffer = io.BytesIO()
        pagesize = landscape(A4) if landscape_mode else A4
        doc = SimpleDocTemplate(
            buffer,
            pagesize=pagesize,
            rightMargin=30,
            leftMargin=30,
            topMargin=30,
            bottomMargin=18,
        )
        styles = getSampleStyleSheet()
        styles["Title"].fontName = PDF_FONT_NAME
        styles["Normal"].fontName = PDF_FONT_NAME

        elements = [
            Paragraph(title_text, styles["Title"]),
            Paragraph(f"Wygenerowano: {timezone.now().strftime('%Y-%m-%d %H:%M')}", styles["Normal"]),
            Spacer(1, 24),
        ]

        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#9c27b0")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTNAME", (0, 0), (-1, 0), PDF_FONT_NAME),
            ("FONTNAME", (0, 1), (-1, -1), PDF_FONT_NAME),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
            ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ]))

        elements.append(table)
        doc.build(elements)
        buffer.seek(0)

        resp = HttpResponse(buffer, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp

    def _revenue_json_report(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        group_by = request.query_params.get("group_by", "day")

        since = timezone.now() - timedelta(days=30)
        until = timezone.now()
        if date_from and date_to:
            since = timezone.make_aware(datetime.combine(datetime.strptime(date_from, "%Y-%m-%d"), time.min))
            until = timezone.make_aware(datetime.combine(datetime.strptime(date_to, "%Y-%m-%d"), time.max))

        completed = Appointment.objects.filter(
            status=Appointment.Status.COMPLETED,
            start__gte=since,
            start__lte=until
        )

        trunc_func = TruncDate("start") if group_by == "day" else TruncMonth("start")
        grouped = (
            completed.annotate(period=trunc_func)
            .values("period")
            .annotate(revenue=Sum("service__price"), count=Count("id"))
            .order_by("period")
        )

        data = [{
            "period": item["period"].strftime("%Y-%m-%d" if group_by == "day" else "%Y-%m"),
            "revenue": float(item["revenue"] or 0),
            "appointments_count": item["count"],
        } for item in grouped]

        summary = completed.aggregate(total_rev=Sum("service__price"), total_app=Count("id"))
        total_rev = summary["total_rev"] or 0
        total_app = summary["total_app"] or 0

        return Response({
            "range": {"from": since.date().isoformat(), "to": until.date().isoformat()},
            "group_by": group_by,
            "summary": {
                "total_revenue": float(total_rev),
                "total_appointments": total_app,
                "average_per_appointment": round(float(total_rev) / total_app, 2) if total_app > 0 else 0,
            },
            "data": data
        })

    def _revenue_pdf_report(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        since = timezone.now() - timedelta(days=30)
        until = timezone.now()
        if date_from and date_to:
            since = timezone.make_aware(datetime.combine(datetime.strptime(date_from, "%Y-%m-%d"), time.min))
            until = timezone.make_aware(datetime.combine(datetime.strptime(date_to, "%Y-%m-%d"), time.max))

        appts = Appointment.objects.filter(
            status=Appointment.Status.COMPLETED,
            start__gte=since,
            start__lte=until
        ).select_related("client", "service", "employee").order_by("start")

        total = appts.aggregate(s=Sum("service__price"))["s"] or 0
        data = [["Data", "Klient", "Usługa", "Cena"]]

        for a in appts:
            c_name = f"{a.client.first_name} {a.client.last_name}" if a.client else "Gość"
            data.append([
                a.start.strftime("%Y-%m-%d"),
                clean_text(c_name),
                clean_text(a.service.name if a.service else "-"),
                f"{a.service.price} zł" if a.service else "-"
            ])

        data.append(["", "", "SUMA:", f"{total} zł"])
        return self._build_pdf_response("Raport Przychodów", data, "raport_finansowy.pdf")

    def _employees_report(self):
        employees = EmployeeProfile.objects.all().order_by("last_name")
        data = [["Nr", "Imię i Nazwisko", "Telefon", "Status"]]
        for e in employees:
            data.append([
                clean_text(e.employee_number),
                clean_text(f"{e.first_name} {e.last_name}"),
                clean_text(e.phone or "-"),
                "Aktywny" if e.is_active else "Nieaktywny"
            ])
        return self._build_pdf_response("Lista Pracowników", data, "pracownicy.pdf")

    def _clients_report(self):
        clients = ClientProfile.objects.all().order_by("last_name")
        data = [["Nr", "Imię i Nazwisko", "Telefon", "Email"]]
        for c in clients:
            data.append([
                clean_text(getattr(c, "client_number", c.id)),
                clean_text(f"{c.first_name} {c.last_name}"),
                clean_text(getattr(c, "phone", None) or "-"),
                clean_text(getattr(c, "email", None) or "-"),
            ])
        return self._build_pdf_response("Baza Klientów", data, "klienci.pdf")

    def _today_appointments_report(self):
        today = timezone.now().date()
        appts = Appointment.objects.filter(start__date=today).select_related("client", "employee", "service").order_by("start")
        data = [["Godz", "Klient", "Pracownik", "Usługa", "Cena"]]

        for a in appts:
            c_name = f"{a.client.first_name} {a.client.last_name}" if a.client else "Gość"
            e_name = f"{a.employee.first_name} {a.employee.last_name}" if a.employee else "-"
            data.append([
                a.start.strftime("%H:%M"),
                clean_text(c_name),
                clean_text(e_name),
                clean_text(a.service.name if a.service else "-"),
                f"{a.service.price} zł" if a.service else "-"
            ])

        return self._build_pdf_response(f"Grafik na dzień {today}", data, "grafik_dzis.pdf")

# =============================================================================
# AUTH (SESSION LOGIN / LOGOUT)
# =============================================================================
@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@authentication_classes([])
def csrf(request):
    return Response({"detail": "CSRF cookie set"})


class SessionLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class SessionLoginAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = SessionLoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        user = authenticate(
            request,
            username=ser.validated_data["username"],
            password=ser.validated_data["password"],
        )

        if user is None:
            return Response(
                {"detail": "Nieprawidłowy login lub hasło."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.is_active:
            return Response(
                {"detail": "Konto jest nieaktywne."},
                status=status.HTTP_403_FORBIDDEN,
            )

        login(request, user)

        SystemLog.log(
            action=SystemLog.Action.AUTH_LOGIN,
            performed_by=user,
            target_user=user,
        )

        return Response(
            {
                "detail": "Zalogowano.",
                "user": UserDetailSerializer(user, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class SessionLogoutAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        logout(request)

        SystemLog.log(
            action=SystemLog.Action.AUTH_LOGOUT,
            performed_by=user,
            target_user=user,
        )

        return Response({"detail": "Wylogowano."}, status=status.HTTP_200_OK)