from __future__ import annotations

from datetime import datetime, timedelta, time
from typing import Any
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Sum, Q, Avg
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError

from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

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
from .permissions import IsAdmin, IsAdminOrEmployee, IsEmployee

User = get_user_model()


# =============================================================================
# Availability helpers (jedno źródło prawdy dla slotów)
# =============================================================================

def _parse_date(date_str: str):
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def _parse_hhmm(hhmm: str) -> time:
    return datetime.strptime(hhmm, "%H:%M").time()


def _weekday_key(d) -> str:
    return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][d.weekday()]


def _compute_slots(*, employee: EmployeeProfile, service: Service, day):
    """
    Jedno źródło prawdy dla slotów.
    - uwzględnia skills (pracownik musi wykonywać usługę),
      grafiki, nieobecności, konflikty + bufor.
    Zwraca listę: [{"start": iso, "end": iso}]
    """
    # pracownik musi wykonywać usługę
    if not employee.skills.filter(id=service.id).exists():
        return []

    # data w przeszłości – brak slotów
    today = timezone.now().date()
    if day < today:
        return []

    # urlop / nieobecność
    if TimeOff.objects.filter(employee=employee, date_from__lte=day, date_to__gte=day).exists():
        return []

    schedule = getattr(employee, "schedule", None)
    if not schedule:
        return []

    periods = (schedule.weekly_hours or {}).get(_weekday_key(day), [])
    if not periods:
        return []

    settings_obj = SystemSettings.get_settings()
    slot_minutes = int(settings_obj.slot_minutes)
    buffer_minutes = int(settings_obj.buffer_minutes)

    service_duration = timedelta(minutes=int(service.duration_minutes))
    block_duration = service_duration + timedelta(minutes=int(buffer_minutes))

    day_start = timezone.make_aware(datetime.combine(day, time(0, 0)))
    day_end = timezone.make_aware(datetime.combine(day, time(23, 59, 59)))

    busy = [
        (s, e + timedelta(minutes=buffer_minutes))
        for (s, e) in Appointment.objects.filter(employee=employee, start__lt=day_end, end__gt=day_start)
            .exclude(status=Appointment.Status.CANCELLED)
            .values_list("start", "end")
    ]

    slots: list[dict] = []
    now = timezone.now()

    for p in periods:
        try:
            p_start = timezone.make_aware(datetime.combine(day, _parse_hhmm(p.get("start", ""))))
            p_end = timezone.make_aware(datetime.combine(day, _parse_hhmm(p.get("end", ""))))
        except Exception:
            return []

        cursor = p_start
        while cursor + block_duration <= p_end:
            candidate_start = cursor
            candidate_end = cursor + service_duration
            candidate_block_end = cursor + block_duration

            # nie pokazuj slotów w przeszłości (dla dzisiejszego dnia)
            if candidate_start < now:
                cursor += timedelta(minutes=slot_minutes)
                continue

            overlap = any(b_start < candidate_block_end and b_end > candidate_start for b_start, b_end in busy)
            if not overlap:
                slots.append({"start": candidate_start.isoformat(), "end": candidate_end.isoformat()})

            cursor += timedelta(minutes=slot_minutes)

    return slots


# =============================================================================
# CRUD (router) — dobre pod obronę: role + filtrowanie + akcje biznesowe
# =============================================================================

class UserViewSet(viewsets.ModelViewSet):
    """
    /users/
    - ADMIN: pełny CRUD
    - każdy zalogowany: /users/me/
    """
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
        return Response(UserDetailSerializer(request.user).data)


class ServiceViewSet(viewsets.ModelViewSet):
    """
    /services/
    - GET: każdy (public)
    - write: ADMIN/EMPLOYEE
    Dodatkowo: enable/disable (bardziej biznesowo niż delete).
    """
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active", "category"]
    search_fields = ["name", "category", "description"]
    ordering_fields = ["id", "name", "price", "duration_minutes", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # public i klient — tylko aktywne
        if not (user and user.is_authenticated) or getattr(user, "role", None) == "CLIENT":
            return qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "disable", "enable"]:
            return [IsAdminOrEmployee()]
        return [permissions.AllowAny()]

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
        SystemLog.log(action=SystemLog.Action.SERVICE_UPDATED, performed_by=request.user)
        return Response({"detail": "Usługa została włączona."})


class EmployeeViewSet(viewsets.ModelViewSet):
    """
    /employees/
    - ADMIN/EMPLOYEE: CRUD
    - public/klient: list/retrieve aktywnych
    Rozszerzenia:
    - /employees/{id}/schedule/ GET,PATCH
    - /employees/{id}/time-off/ POST,GET
    - /employees/me/available-slots/ GET  (NOWE) — tylko pracownik i tylko swoje
    """
    queryset = EmployeeProfile.objects.all().prefetch_related("skills")
    serializer_class = EmployeeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active", "employee_number"]
    search_fields = ["employee_number", "first_name", "last_name"]
    ordering_fields = ["id", "employee_number", "last_name", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not (user and user.is_authenticated) or getattr(user, "role", None) == "CLIENT":
            return qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        # ✅ NOWE: pracownik ma dostęp tylko do swojego endpointu
        if self.action == "my_available_slots":
            return [IsEmployee()]

        if self.action in ["create", "update", "partial_update", "destroy", "schedule", "time_offs"]:
            return [IsAdminOrEmployee()]

        return [permissions.AllowAny()]

    @action(detail=True, methods=["get", "patch"], url_path="schedule")
    def schedule(self, request, pk=None):
        """
        GET/PATCH grafik pracownika (EmployeeSchedule.weekly_hours).
        """
        employee = self.get_object()
        schedule, _ = EmployeeSchedule.objects.get_or_create(employee=employee)

        if request.method == "GET":
            return Response(EmployeeScheduleSerializer(schedule).data)

        ser = EmployeeScheduleSerializer(schedule, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        SystemLog.log(action=SystemLog.Action.EMPLOYEE_UPDATED, performed_by=request.user)
        return Response(ser.data)

    @action(detail=True, methods=["get", "post"], url_path="time-off")
    def time_offs(self, request, pk=None):
        """
        GET lista nieobecności
        POST dodaje nieobecność
        """
        employee = self.get_object()

        if request.method == "GET":
            qs = TimeOff.objects.filter(employee=employee).order_by("-date_from")
            return Response(TimeOffSerializer(qs, many=True).data)

        ser = TimeOffSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = ser.save(employee=employee)
        SystemLog.log(action=SystemLog.Action.EMPLOYEE_UPDATED, performed_by=request.user)
        return Response(TimeOffSerializer(obj).data, status=status.HTTP_201_CREATED)

    # ✅ NOWE: pracownik widzi sloty swojego grafiku – tylko dla swoich usług
    @action(detail=False, methods=["get"], url_path="me/available-slots")
    def my_available_slots(self, request):
        """
        GET /employees/me/available-slots/?service_id=...&date=YYYY-MM-DD
        """
        employee = getattr(request.user, "employee_profile", None)
        if not employee:
            return Response({"detail": "Brak profilu pracownika."}, status=status.HTTP_404_NOT_FOUND)

        service_id = request.query_params.get("service_id")
        date_str = request.query_params.get("date")

        if not service_id or not date_str:
            return Response(
                {"detail": "Wymagane parametry: service_id, date (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            service = Service.objects.get(pk=int(service_id), is_active=True)
        except Exception:
            return Response({"detail": "Nie znaleziono usługi."}, status=status.HTTP_404_NOT_FOUND)

        # pracownik tylko do swoich usług
        if not employee.skills.filter(id=service.id).exists():
            return Response(
                {"detail": "Ta usługa nie należy do Twoich umiejętności."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            day = _parse_date(date_str)
        except Exception:
            return Response(
                {"detail": "Nieprawidłowy format daty. Użyj YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        slots = _compute_slots(employee=employee, service=service, day=day)
        return Response({"date": date_str, "employee_id": employee.id, "slots": slots})


class ClientViewSet(viewsets.ModelViewSet):
    """
    /clients/
    - ADMIN/EMPLOYEE: CRUD
    - CLIENT: /clients/me/
    """
    queryset = ClientProfile.objects.all()
    serializer_class = ClientSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active", "client_number"]
    search_fields = ["client_number", "first_name", "last_name", "email", "phone"]
    ordering_fields = ["id", "client_number", "last_name", "created_at"]

    def get_permissions(self):
        if self.action == "me":
            return [permissions.IsAuthenticated()]
        return [IsAdminOrEmployee()]

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        profile = getattr(request.user, "client_profile", None)
        if not profile:
            return Response({"detail": "Brak profilu klienta dla tego konta."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ClientSerializer(profile).data)


class AppointmentViewSet(viewsets.ModelViewSet):
    """
    /appointments/
    - ADMIN: wszystko
    - EMPLOYEE: wszystko (MVP) + /appointments/my/ jako wygodny filtr
    - CLIENT: tylko swoje (list/retrieve)
    Rozszerzenia biznesowe:
    - /appointments/{id}/confirm/
    - /appointments/{id}/cancel/
    - /appointments/{id}/complete/
    """
    queryset = Appointment.objects.select_related("client", "employee", "service").all()
    serializer_class = AppointmentSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status", "employee", "service", "client"]
    ordering_fields = ["start", "status", "created_at"]

    def get_permissions(self):
        user = self.request.user
        role = getattr(user, "role", None)

        if self.action in ["confirm", "cancel", "complete"]:
            return [IsAdminOrEmployee()]

        if self.action in ["my"]:
            return [IsEmployee()]

        if self.action in ["list", "retrieve"] and role == "CLIENT":
            return [permissions.IsAuthenticated()]

        return [IsAdminOrEmployee()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if not (user and user.is_authenticated):
            return qs.none()

        role = getattr(user, "role", None)

        if role == "CLIENT":
            profile = getattr(user, "client_profile", None)
            if not profile:
                return qs.none()
            return qs.filter(client=profile)

        if role == "EMPLOYEE":
            # MVP: pracownik widzi wszystko (łatwiej na demo)
            return qs

        return qs  # ADMIN

    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request):
        """
        Wygodny endpoint dla pracownika: lista jego wizyt.
        """
        employee = getattr(request.user, "employee_profile", None)
        if not employee:
            return Response({"detail": "Brak profilu pracownika."}, status=status.HTTP_404_NOT_FOUND)
        qs = self.get_queryset().filter(employee=employee)
        return Response(AppointmentSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        """Potwierdź wizytę - zmiana statusu z PENDING na CONFIRMED"""
        appt = self.get_object()

        if appt.status != Appointment.Status.PENDING:
            return Response(
                {"detail": "Można potwierdzić tylko wizyty w statusie PENDING."},
                status=status.HTTP_400_BAD_REQUEST
            )

        appt.status = Appointment.Status.CONFIRMED
        appt.save(update_fields=["status"])
        SystemLog.log(action=SystemLog.Action.APPOINTMENT_CONFIRMED, performed_by=request.user)
        return Response(AppointmentSerializer(appt).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Anuluj wizytę"""
        appt = self.get_object()

        if appt.status == Appointment.Status.CANCELLED:
            return Response(
                {"detail": "Wizyta jest już anulowana."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if appt.status == Appointment.Status.COMPLETED:
            return Response(
                {"detail": "Nie można anulować zakończonej wizyty."},
                status=status.HTTP_400_BAD_REQUEST
            )

        appt.status = Appointment.Status.CANCELLED
        appt.internal_notes += f"\n[ANULOWANO {timezone.now():%Y-%m-%d %H:%M}] przez {request.user.username}"
        appt.save(update_fields=["status", "internal_notes"])
        SystemLog.log(action=SystemLog.Action.APPOINTMENT_CANCELLED, performed_by=request.user)
        return Response(AppointmentSerializer(appt).data)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        """Zakończ wizytę - oznacz jako COMPLETED"""
        appt = self.get_object()

        if appt.status not in [Appointment.Status.PENDING, Appointment.Status.CONFIRMED]:
            return Response(
                {"detail": "Można zakończyć tylko wizyty potwierdzone lub oczekujące."},
                status=status.HTTP_400_BAD_REQUEST
            )

        appt.status = Appointment.Status.COMPLETED
        appt.save(update_fields=["status"])
        SystemLog.log(action=SystemLog.Action.APPOINTMENT_COMPLETED, performed_by=request.user)
        return Response(AppointmentSerializer(appt).data)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /audit-logs/
    Endpoint zostaje jak w urls.py, model to SystemLog.
    """
    queryset = SystemLog.objects.select_related("performed_by", "target_user").all()
    serializer_class = SystemLogSerializer
    permission_classes = [IsAdmin]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["action", "performed_by", "target_user"]
    ordering_fields = ["timestamp"]


# =============================================================================
# Settings + Statistics (po routerze)
# =============================================================================

class SystemSettingsView(APIView):
    """
    /system-settings/
    - GET, PATCH: ADMIN
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        obj = SystemSettings.get_settings()
        return Response(SystemSettingsSerializer(obj).data)

    def patch(self, request):
        obj = SystemSettings.get_settings()
        ser = SystemSettingsSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save(updated_by=request.user)
        SystemLog.log(action=SystemLog.Action.SETTINGS_UPDATED, performed_by=request.user)
        return Response(ser.data)


class StatisticsView(APIView):
    """
    /statistics/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
    Jeśli brak parametrów -> ostatnie 30 dni.
    """
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
                return Response({"detail": "Nieprawidłowy format daty. Użyj YYYY-MM-DD."},
                                status=status.HTTP_400_BAD_REQUEST)
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
            .aggregate(total=Sum("service__price"))["total"] or 0
        )

        return Response({
            "range": {
                "from": since.date().isoformat(),
                "to": until.date().isoformat(),
            },
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
# Dashboard + reporty
# =============================================================================

class DashboardView(APIView):
    """
    GET /dashboard/
    Zwraca dane dostosowane do roli użytkownika:
    - ADMIN: statystyki globalne, wizyty dzisiaj, pending appointments
    - EMPLOYEE: dzisiejszy grafik, nadchodzące wizyty
    - CLIENT: nadchodzące wizyty, historia
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.is_admin_role:
            return self._admin_dashboard()
        elif user.is_employee:
            return self._employee_dashboard(user)
        elif user.is_client:
            return self._client_dashboard(user)

        return Response({"detail": "Brak uprawnień"}, status=status.HTTP_403_FORBIDDEN)

    def _admin_dashboard(self):
        today = timezone.now().date()
        now = timezone.now()

        today_appointments = Appointment.objects.filter(start__date=today)

        pending_count = Appointment.objects.filter(
            status=Appointment.Status.PENDING
        ).count()

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
                "appointments": AppointmentSerializer(
                    today_appointments.order_by('start')[:10],
                    many=True
                ).data,
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

    def _employee_dashboard(self, user):
        try:
            employee = user.employee_profile
            today = timezone.now()
            today_date = today.date()

            today_schedule = Appointment.objects.filter(
                employee=employee,
                start__date=today_date,
                status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED]
            ).order_by('start')

            week_later = today + timedelta(days=7)
            upcoming = Appointment.objects.filter(
                employee=employee,
                start__gte=today,
                start__lte=week_later,
                status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED]
            ).order_by('start')

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
                    "appointments": AppointmentSerializer(today_schedule, many=True).data,
                },
                "upcoming": {
                    "count": upcoming.count(),
                    "appointments": AppointmentSerializer(upcoming[:5], many=True).data,
                },
                "this_month": {
                    "completed_appointments": month_completed,
                }
            })
        except Exception as e:
            return Response(
                {"detail": f"Brak profilu pracownika: {str(e)}"},
                status=status.HTTP_404_NOT_FOUND
            )

    def _client_dashboard(self, user):
        try:
            client = user.client_profile
            now = timezone.now()

            upcoming = Appointment.objects.filter(
                client=client,
                start__gte=now,
                status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED]
            ).order_by('start')

            history_count = Appointment.objects.filter(
                client=client,
                status=Appointment.Status.COMPLETED
            ).count()

            recent_history = Appointment.objects.filter(
                client=client,
                status=Appointment.Status.COMPLETED
            ).order_by('-start')[:3]

            return Response({
                "role": "CLIENT",
                "client_number": client.client_number,
                "full_name": client.get_full_name(),
                "upcoming_appointments": {
                    "count": upcoming.count(),
                    "appointments": AppointmentSerializer(upcoming[:5], many=True).data,
                },
                "history": {
                    "total_completed": history_count,
                    "recent": AppointmentSerializer(recent_history, many=True).data,
                }
            })
        except Exception as e:
            return Response(
                {"detail": f"Brak profilu klienta: {str(e)}"},
                status=status.HTTP_404_NOT_FOUND
            )


class RevenueReportView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        group_by = request.query_params.get("group_by", "day")

        if not date_from or not date_to:
            return Response(
                {"detail": "Wymagane parametry: date_from, date_to (YYYY-MM-DD)"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            start_date = datetime.strptime(date_from, "%Y-%m-%d").date()
            end_date = datetime.strptime(date_to, "%Y-%m-%d").date()
        except Exception:
            return Response(
                {"detail": "Nieprawidłowy format daty. Użyj YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        since = timezone.make_aware(datetime.combine(start_date, time(0, 0)))
        until = timezone.make_aware(datetime.combine(end_date, time(23, 59, 59)))

        completed = Appointment.objects.filter(
            status=Appointment.Status.COMPLETED,
            start__gte=since,
            start__lte=until
        ).select_related('service')

        revenue_data = []

        if group_by == "month":
            from django.db.models.functions import TruncMonth
            grouped = completed.annotate(
                month=TruncMonth('start')
            ).values('month').annotate(
                revenue=Sum('service__price'),
                count=Count('id')
            ).order_by('month')

            for item in grouped:
                revenue_data.append({
                    "period": item['month'].strftime('%Y-%m'),
                    "revenue": float(item['revenue'] or 0),
                    "appointments_count": item['count']
                })
        else:
            from django.db.models.functions import TruncDate
            grouped = completed.annotate(
                day=TruncDate('start')
            ).values('day').annotate(
                revenue=Sum('service__price'),
                count=Count('id')
            ).order_by('day')

            for item in grouped:
                revenue_data.append({
                    "period": item['day'].strftime('%Y-%m-%d'),
                    "revenue": float(item['revenue'] or 0),
                    "appointments_count": item['count']
                })

        total_revenue = sum(item['revenue'] for item in revenue_data)
        total_appointments = sum(item['appointments_count'] for item in revenue_data)

        return Response({
            "range": {
                "from": start_date.isoformat(),
                "to": end_date.isoformat(),
            },
            "group_by": group_by,
            "summary": {
                "total_revenue": total_revenue,
                "total_appointments": total_appointments,
                "average_per_appointment": round(total_revenue / total_appointments, 2) if total_appointments > 0 else 0,
            },
            "data": revenue_data,
        })


class EmployeePerformanceView(APIView):
    permission_classes = [IsAdminOrEmployee]

    def get(self, request):
        employee_id = request.query_params.get("employee_id")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if not employee_id:
            return Response(
                {"detail": "Wymagany parametr: employee_id"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            employee = EmployeeProfile.objects.get(pk=int(employee_id))
        except Exception:
            return Response(
                {"detail": "Nie znaleziono pracownika."},
                status=status.HTTP_404_NOT_FOUND
            )

        now = timezone.now()
        if date_from and date_to:
            try:
                start_date = datetime.strptime(date_from, "%Y-%m-%d").date()
                end_date = datetime.strptime(date_to, "%Y-%m-%d").date()
                since = timezone.make_aware(datetime.combine(start_date, time(0, 0)))
                until = timezone.make_aware(datetime.combine(end_date, time(23, 59, 59)))
            except Exception:
                return Response(
                    {"detail": "Nieprawidłowy format daty."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            since = now - timedelta(days=30)
            until = now

        appointments = Appointment.objects.filter(
            employee=employee,
            start__gte=since,
            start__lte=until
        )

        total_count = appointments.count()
        completed_count = appointments.filter(status=Appointment.Status.COMPLETED).count()
        cancelled_count = appointments.filter(status=Appointment.Status.CANCELLED).count()

        revenue = appointments.filter(
            status=Appointment.Status.COMPLETED
        ).aggregate(total=Sum('service__price'))['total'] or Decimal("0")

        top_services = appointments.values(
            'service__id', 'service__name'
        ).annotate(
            count=Count('id')
        ).order_by('-count')[:5]

        return Response({
            "employee": {
                "id": employee.id,
                "employee_number": employee.employee_number,
                "full_name": employee.get_full_name(),
            },
            "period": {
                "from": since.date().isoformat(),
                "to": until.date().isoformat(),
            },
            "statistics": {
                "total_appointments": total_count,
                "completed": completed_count,
                "cancelled": cancelled_count,
                "completion_rate": round((completed_count / total_count * 100), 2) if total_count > 0 else 0,
                "total_revenue": float(revenue),
            },
            "top_services": list(top_services),
        })


class PopularServicesView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        limit = int(request.query_params.get("limit", 10))

        now = timezone.now()
        if date_from and date_to:
            try:
                start_date = datetime.strptime(date_from, "%Y-%m-%d").date()
                end_date = datetime.strptime(date_to, "%Y-%m-%d").date()
                since = timezone.make_aware(datetime.combine(start_date, time(0, 0)))
                until = timezone.make_aware(datetime.combine(end_date, time(23, 59, 59)))
            except Exception:
                return Response(
                    {"detail": "Nieprawidłowy format daty."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            since = now - timedelta(days=30)
            until = now

        popular_services = (
            Appointment.objects.filter(start__gte=since, start__lte=until)
            .values('service__id', 'service__name', 'service__price', 'service__category')
            .annotate(
                bookings_count=Count('id'),
                completed_count=Count('id', filter=Q(status=Appointment.Status.COMPLETED)),
                total_revenue=Sum('service__price', filter=Q(status=Appointment.Status.COMPLETED))
            )
            .order_by('-bookings_count')[:limit]
        )

        return Response({
            "period": {
                "from": since.date().isoformat(),
                "to": until.date().isoformat(),
            },
            "services": [
                {
                    "service_id": item['service__id'],
                    "name": item['service__name'],
                    "category": item['service__category'],
                    "price": float(item['service__price']),
                    "bookings_count": item['bookings_count'],
                    "completed_count": item['completed_count'],
                    "total_revenue": float(item['total_revenue'] or 0),
                }
                for item in popular_services
            ]
        })


# =============================================================================
# Availability + Booking (logika biznesowa) — publiczne sloty + bezpieczne bookowanie
# =============================================================================

class AvailabilitySlotsAPIView(APIView):
    """
    GET /availability/slots/?employee_id=...&service_id=...&date=YYYY-MM-DD
    Publiczny, żeby dało się wyszukiwać terminy bez logowania.
    """
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
            return Response({"detail": "Nieprawidłowy format daty. Użyj YYYY-MM-DD."},
                            status=status.HTTP_400_BAD_REQUEST)

        slots = _compute_slots(employee=employee, service=service, day=day)
        return Response({"date": date_str, "slots": slots})


class BookingCreateAPIView(APIView):
    """
    POST /appointments/book/
    Tworzy Appointment (rezerwacja).
    - CLIENT rezerwuje dla siebie (automatycznie przypisuje client z request.user)
    - ADMIN/EMPLOYEE może rezerwować podając client_id
    """
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        ser = BookingCreateSerializer(data=request.data, context={"request": request})
        try:
            ser.is_valid(raise_exception=True)
            appointment = ser.save()
        except DRFValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except DjangoValidationError as e:
            return Response(getattr(e, "message_dict", {"detail": e.messages}), status=status.HTTP_400_BAD_REQUEST)

        SystemLog.log(action=SystemLog.Action.APPOINTMENT_CREATED, performed_by=request.user)
        return Response(AppointmentSerializer(appointment).data, status=status.HTTP_201_CREATED)


class CheckAvailabilityView(APIView):
    """
    POST /appointments/check-availability/
    Sprawdza czy konkretny termin jest dostępny dla danego pracownika i usługi
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        employee_id = request.data.get("employee_id")
        service_id = request.data.get("service_id")
        start_str = request.data.get("start")

        if not all([employee_id, service_id, start_str]):
            return Response(
                {"detail": "Wymagane pola: employee_id, service_id, start (ISO format)"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            employee = EmployeeProfile.objects.get(pk=int(employee_id), is_active=True)
        except Exception:
            return Response(
                {"available": False, "reason": "Nie znaleziono pracownika."},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            service = Service.objects.get(pk=int(service_id), is_active=True)
        except Exception:
            return Response(
                {"available": False, "reason": "Nie znaleziono usługi."},
                status=status.HTTP_404_NOT_FOUND
            )

        if not employee.skills.filter(id=service.id).exists():
            return Response({
                "available": False,
                "reason": "Ten pracownik nie wykonuje wybranej usługi."
            }, status=status.HTTP_200_OK)

        try:
            start = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
            if timezone.is_naive(start):
                start = timezone.make_aware(start)
        except Exception:
            return Response(
                {"available": False, "reason": "Nieprawidłowy format daty. Użyj ISO format."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if TimeOff.objects.filter(
                employee=employee,
                date_from__lte=start.date(),
                date_to__gte=start.date()
        ).exists():
            return Response({
                "available": False,
                "reason": "Pracownik jest nieobecny w tym dniu."
            })

        settings_obj = SystemSettings.get_settings()
        buffer_minutes = int(settings_obj.buffer_minutes or 0)

        service_duration = timedelta(minutes=int(service.duration_minutes))
        service_end = start + service_duration
        end_with_buffer = service_end + timedelta(minutes=buffer_minutes)

        conflicts = Appointment.objects.filter(
            employee=employee,
            start__lt=end_with_buffer,
            end__gt=start
        ).exclude(status=Appointment.Status.CANCELLED)

        if conflicts.exists():
            return Response({
                "available": False,
                "reason": "Pracownik ma już zarezerwowaną wizytę w tym czasie."
            }, status=status.HTTP_200_OK)

        return Response({
            "available": True,
            "start": start.isoformat(),
            "end": service_end.isoformat(),
            "service_duration_minutes": int(service.duration_minutes),
            "buffer_minutes": buffer_minutes,
            "blocked_until": end_with_buffer.isoformat()
        }, status=status.HTTP_200_OK)
