from __future__ import annotations

import io
import os
from datetime import datetime, time, timedelta
from decimal import Decimal


from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce, ExtractWeekDay
from django.http import Http404, HttpResponse
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Case, When, Value, IntegerField

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.fonts import addMapping
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from .models import (
    Appointment,
    ClientProfile,
    EmployeeProfile,
    EmployeeSchedule,
    Service,
    SystemLog,
    SystemSettings,
    TimeOff,
)
from .permissions import CanCancelAppointment, IsAdmin, IsAdminOrEmployee, IsEmployee
from .serializers import (
    AppointmentSerializer,
    BookingCreateSerializer,
    ClientSerializer,
    EmployeeScheduleSerializer,
    EmployeeSerializer,
    EmployeePublicSerializer,
    PasswordResetSerializer,
    ServiceSerializer,
    SystemLogSerializer,
    SystemSettingsSerializer,
    TimeOffSerializer,
    UserCreateSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)

User = get_user_model()

FONT_PATH = os.path.join(settings.BASE_DIR, "static", "fonts", "DejaVuSans.ttf")
PDF_FONT_NAME = "DejaVuSans"

try:
    if os.path.exists(FONT_PATH):
        pdfmetrics.registerFont(TTFont(PDF_FONT_NAME, FONT_PATH))
        addMapping(PDF_FONT_NAME, 0, 0, PDF_FONT_NAME)
    else:
        PDF_FONT_NAME = "Helvetica"
except (IOError, OSError):
    PDF_FONT_NAME = "Helvetica"


def clean_text(s):
    if s is None:
        return ""
    return str(s).replace("\u00a0", " ").replace("\u200b", "")

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
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
        return Response(
            UserDetailSerializer(request.user, context={"request": request}).data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="reset-password",
        permission_classes=[IsAdmin],
    )
    def reset_password(self, request, pk=None):
        target_user = self.get_object()

        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_user.set_password(serializer.validated_data["new_password"])
        target_user.save(update_fields=["password"])

        SystemLog.log(
            action=SystemLog.Action.AUTH_PASSWORD_CHANGE,
            performed_by=request.user,
            target_user=target_user,
        )

        return Response(
            {
                "detail": f"Hasło użytkownika {target_user.username} zostało zresetowane."
            },
            status=status.HTTP_200_OK,
        )


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["is_active", "category"]
    search_fields = ["name", "category", "description"]
    ordering_fields = ["id", "name", "price", "duration_minutes", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if (
            user
            and user.is_authenticated
            and hasattr(user, "role")
            and user.role == "CLIENT"
        ):
            return qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in [
            "create",
            "update",
            "partial_update",
            "destroy",
            "disable",
            "enable",
        ]:
            return [IsAdminOrEmployee()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save()
        SystemLog.log(
            action=SystemLog.Action.SERVICE_CREATED,
            performed_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save()
        SystemLog.log(
            action=SystemLog.Action.SERVICE_UPDATED,
            performed_by=self.request.user,
        )

    @action(detail=True, methods=["post"], url_path="disable")
    def disable(self, request, pk=None):
        obj = self.get_object()
        obj.is_active = False
        obj.save(update_fields=["is_active"])
        SystemLog.log(
            action=SystemLog.Action.SERVICE_DISABLED, performed_by=request.user
        )
        return Response({"detail": "Usługa została wyłączona."})

    @action(detail=True, methods=["post"], url_path="enable")
    def enable(self, request, pk=None):
        obj = self.get_object()
        obj.is_active = True
        obj.save(update_fields=["is_active"])
        SystemLog.log(
            action=SystemLog.Action.SERVICE_ENABLED, performed_by=request.user
        )
        return Response({"detail": "Usługa została włączona."})


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = EmployeeProfile.objects.all().prefetch_related("skills").order_by("id")
    serializer_class = EmployeeSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["is_active", "employee_number"]
    search_fields = ["employee_number", "first_name", "last_name"]
    ordering_fields = ["id", "employee_number", "last_name", "created_at"]

    def get_serializer_class(self):
        user = getattr(self.request, "user", None)
        role = (
            user.role
            if (user and user.is_authenticated and hasattr(user, "role"))
            else None
        )

        if role == "CLIENT" and self.action in ["list", "retrieve"]:
            return EmployeePublicSerializer

        return EmployeeSerializer

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

        if not user.is_authenticated or not hasattr(user, "role"):
            return qs.none()

        service_id = self.request.query_params.get("service_id")
        if service_id not in (None, ""):
            try:
                service_id_int = int(service_id)
            except (TypeError, ValueError):
                raise ValidationError(
                    {"service_id": "Nieprawidłowa wartość. Oczekiwano liczby całkowitej."}
                )
            qs = qs.filter(skills__id=service_id_int).distinct()

        if user.role == "CLIENT":
            qs = qs.filter(is_active=True)
            return qs

        if user.role == "EMPLOYEE":
            return qs.filter(user=user, is_active=True)

        return qs


    def get_permissions(self):
        if self.action == "schedule":
            if self.request.method in ["PATCH", "PUT"]:
                return [IsAdmin()]
            return [IsAdminOrEmployee()]

        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAdminOrEmployee()]

        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        user = self.request.user

        if user.role == "EMPLOYEE":
            employee_profile = getattr(user, 'employee_profile', None)
            obj = serializer.save(employee=employee_profile)
        else:
            obj = serializer.save()

        SystemLog.log(
            action=SystemLog.Action.EMPLOYEE_CREATED,
            performed_by=user,
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
            return Response(
                EmployeeScheduleSerializer(schedule, context={"request": request}).data
            )

        ser = EmployeeScheduleSerializer(
            schedule,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save()

        SystemLog.log(
            action=SystemLog.Action.EMPLOYEE_UPDATED,
            performed_by=request.user,
            target_user=getattr(employee, "user", None),
        )

        return Response(ser.data)


class TimeOffViewSet(viewsets.ModelViewSet):
    serializer_class = TimeOffSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.OrderingFilter,
        filters.SearchFilter,
    ]
    filterset_fields = ["status", "employee"]
    ordering_fields = ["created_at", "date_from", "date_to"]
    search_fields = ["reason", "employee__first_name", "employee__last_name"]

    def get_permissions(self):
        if self.action in ["approve", "reject"]:
            return [IsAdmin()]

        if self.action == "create":
            return [IsEmployee()]

        if self.action == "cancel":
            return [IsEmployee()]

        if self.action in ["update", "partial_update", "destroy"]:
            raise PermissionDenied(
                "Edycja i usuwanie wniosków urlopowych jest zablokowane."
            )

        return [IsAdminOrEmployee()]

    def get_queryset(self):
        qs = TimeOff.objects.annotate(
            status_priority=Case(
                When(status=TimeOff.Status.CANCELLED, then=Value(1)),  # Anulowany
                When(status=TimeOff.Status.PENDING, then=Value(2)),
                When(status=TimeOff.Status.REJECTED, then=Value(3)),
                When(status=TimeOff.Status.APPROVED, then=Value(4)),
                default=Value(5),
                output_field=IntegerField(),
            )
        ).select_related(
            "employee", "employee__user", "requested_by", "decided_by"
        )

        user = self.request.user
        if not user.is_authenticated or not hasattr(user, "role"):
            return qs.none()

        role = user.role
        if role == "CLIENT":
            return qs.none()

        if role == "EMPLOYEE":
            emp = getattr(user, "employee_profile", None)
            if not emp:
                return qs.none()
            qs = qs.filter(employee=emp)

        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if date_from:
            try:
                df = datetime.strptime(date_from, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                raise ValidationError({"date_from": "Nieprawidłowy format daty."})
            qs = qs.filter(date_to__gte=df)

        if date_to:
            try:
                dt = datetime.strptime(date_to, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                raise ValidationError({"date_to": "Nieprawidłowy format daty."})
            qs = qs.filter(date_from__lte=dt)

        ordering = self.request.query_params.get('ordering')

        if ordering == 'status':
            return qs.order_by('status_priority')
        elif ordering == '-status':
            return qs.order_by('-status_priority')
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user

        if not hasattr(user, "role"):
            raise PermissionDenied("Brak roli użytkownika.")

        if user.role != "EMPLOYEE":
            raise PermissionDenied("Tylko pracownik może wysłać wniosek urlopowy.")

        emp = getattr(user, "employee_profile", None)
        if not emp:
            raise PermissionDenied("Brak profilu pracownika.")

        obj = serializer.save(
            employee=emp,
            status=TimeOff.Status.PENDING,
            requested_by=user,
        )

        SystemLog.log(
            action=SystemLog.Action.TIMEOFF_CREATED,
            performed_by=user,
            target_user=getattr(obj.employee, "user", None),
        )

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        obj: TimeOff = self.get_object()

        if obj.status != TimeOff.Status.PENDING:
            return Response(
                {"detail": "Można akceptować tylko wnioski PENDING."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        conflicting_appointments = Appointment.objects.filter(
            employee=obj.employee,
            start__date__gte=obj.date_from,
            start__date__lte=obj.date_to,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
        )

        if conflicting_appointments.exists():
            count = conflicting_appointments.count()
            return Response(
                {
                    "detail": f"Nie można zaakceptować urlopu. Pracownik ma {count} aktywnych wizyt w tym okresie. "
                    f"Anuluj najpierw wizyty lub zmień daty urlopu."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        obj.status = TimeOff.Status.APPROVED
        obj.decided_by = request.user
        obj.decided_at = timezone.now()

        try:
            obj.full_clean()
        except DjangoValidationError as e:
            raise ValidationError(e.message_dict)

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
            return Response(
                {"detail": "Można odrzucać tylko wnioski PENDING."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):

        obj: TimeOff = self.get_object()

        if obj.status != TimeOff.Status.PENDING:
            return Response(
                {"detail": "Można anulować tylko wnioski w statusie PENDING."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        if not hasattr(user, "role"):
            raise PermissionDenied("Brak roli użytkownika.")

        is_owner_employee = (user.role == "EMPLOYEE") and (
            obj.employee.user_id == user.id
        )
        if not is_owner_employee:
            raise PermissionDenied("Brak uprawnień do anulowania tego wniosku.")

        obj.status = TimeOff.Status.CANCELLED
        obj.decided_by = user
        obj.decided_at = timezone.now()
        obj.save(update_fields=["status", "decided_by", "decided_at"])

        SystemLog.log(
            action=SystemLog.Action.TIMEOFF_CANCELLED,
            performed_by=user,
            target_user=getattr(obj.employee, "user", None),
        )

        return Response(TimeOffSerializer(obj, context={"request": request}).data)

class ClientViewSet(viewsets.ModelViewSet):
    queryset = ClientProfile.objects.filter(is_active=True).order_by("id")
    serializer_class = ClientSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["is_active", "client_number"]
    search_fields = ["client_number", "first_name", "last_name", "email", "phone"]
    ordering_fields = ["id", "client_number", "last_name", "created_at"]

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .annotate(appointments_count=Count("appointments", distinct=True))
        )

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

    def destroy(self, request, *args, **kwargs):
        client = self.get_object()

        if client.is_active:
            client.is_active = False
            client.save(update_fields=["is_active"])

            SystemLog.log(
                action=SystemLog.Action.CLIENT_UPDATED,
                performed_by=request.user,
                target_user=getattr(client, "user", None),
            )

        return Response(status=status.HTTP_204_NO_CONTENT)

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

class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status", "employee", "service", "client"]
    ordering_fields = ["start", "status", "created_at"]

    def get_permissions(self):
        if self.action == "notes":
            return [IsAdminOrEmployee()]

        if self.action in ["confirm", "complete", "no_show"]:
            return [IsAdminOrEmployee()]

        if self.action == "cancel":
            return [CanCancelAppointment()]

        if self.action == "my":
            return [IsEmployee()]

        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated()]

        return [IsAdminOrEmployee()]

    def get_queryset(self):
        qs = super().get_queryset().select_related("client", "employee", "service")
        user = self.request.user

        if not (user and user.is_authenticated):
            return qs.none()

        if not hasattr(user, "role"):
            return qs.none()

        role = user.role

        if role == "CLIENT":
            profile = getattr(user, "client_profile", None)
            return qs.filter(client=profile) if profile else qs.none()

        if role == "EMPLOYEE":
            employee = getattr(user, "employee_profile", None)
            return qs.filter(employee=employee) if employee else qs.none()

        return qs

    def _lock_appt(self, pk):
        base_qs = self.get_queryset().select_related(None)

        try:
            return base_qs.select_for_update().get(pk=pk)
        except Appointment.DoesNotExist:
            raise Http404("Appointment not found.")

    def perform_create(self, serializer):
        obj = serializer.save()
        SystemLog.log(
            action=SystemLog.Action.APPOINTMENT_CREATED,
            performed_by=self.request.user,
            target_user=getattr(getattr(obj, "client", None), "user", None),
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        SystemLog.log(
            action=SystemLog.Action.APPOINTMENT_UPDATED,
            performed_by=self.request.user,
            target_user=getattr(getattr(obj, "client", None), "user", None),
        )

    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request):
        employee = getattr(request.user, "employee_profile", None)
        if not employee:
            return Response(
                {"detail": "Brak profilu pracownika."}, status=status.HTTP_404_NOT_FOUND
            )

        qs = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(qs)
        if page is not None:
            ser = AppointmentSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(ser.data)

        ser = AppointmentSerializer(qs, many=True, context={"request": request})
        return Response(ser.data)

    @action(detail=True, methods=["patch"], url_path="notes")
    @transaction.atomic
    def notes(self, request, pk=None):
        appt = self._lock_appt(pk)
        self.check_object_permissions(request, appt)

        notes = request.data.get("internal_notes", "")
        if notes is None:
            notes = ""

        if not isinstance(notes, str):
            return Response(
                {"internal_notes": "internal_notes musi być tekstem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        appt.internal_notes = notes
        appt.save(update_fields=["internal_notes", "updated_at"])

        return Response(
            AppointmentSerializer(appt, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="confirm")
    @transaction.atomic
    def confirm(self, request, pk=None):
        appt = self._lock_appt(pk)
        self.check_object_permissions(request, appt)

        if appt.status != Appointment.Status.PENDING:
            return Response(
                {"detail": "Można potwierdzić tylko wizyty w statusie PENDING."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if appt.start <= timezone.now():
            return Response(
                {"detail": "Nie można potwierdzić wizyty, która już się rozpoczęła."},
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
        appt = self._lock_appt(pk)
        self.check_object_permissions(request, appt)

        if appt.status == Appointment.Status.CANCELLED:
            return Response(
                {"detail": "Wizyta jest już anulowana."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if appt.status == Appointment.Status.COMPLETED:
            return Response(
                {"detail": "Nie można anulować zakończonej wizyty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if appt.status not in [
            Appointment.Status.PENDING,
            Appointment.Status.CONFIRMED,
        ]:
            return Response(
                {"detail": "Nie można anulować wizyty w tym statusie."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if appt.start <= timezone.now():
            return Response(
                {"detail": "Nie można anulować wizyty, która już się rozpoczęła."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
        appt = self._lock_appt(pk)
        self.check_object_permissions(request, appt)

        if appt.status not in [
            Appointment.Status.PENDING,
            Appointment.Status.CONFIRMED,
        ]:
            return Response(
                {"detail": "Można zakończyć tylko wizyty potwierdzone lub oczekujące."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if appt.end > timezone.now():
            return Response(
                {"detail": "Nie można zakończyć wizyty przed jej zakończeniem."},
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

    @action(detail=True, methods=["post"], url_path="no-show")
    @transaction.atomic
    def no_show(self, request, pk=None):
        appt = self._lock_appt(pk)
        self.check_object_permissions(request, appt)

        if appt.status != Appointment.Status.CONFIRMED:
            return Response(
                {"detail": "No-show można ustawić tylko dla wizyt potwierdzonych."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if appt.end > timezone.now():
            return Response(
                {"detail": "No-show można ustawić dopiero po zakończeniu wizyty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        appt.status = Appointment.Status.NO_SHOW
        appt.internal_notes = (appt.internal_notes or "") + (
            f"\n[NO_SHOW {timezone.now():%Y-%m-%d %H:%M}] przez {request.user.username}"
        )
        appt.save(update_fields=["status", "internal_notes"])

        SystemLog.log(
            action=SystemLog.Action.APPOINTMENT_NO_SHOW,
            performed_by=request.user,
            target_user=getattr(getattr(appt, "client", None), "user", None),
        )

        return Response(AppointmentSerializer(appt, context={"request": request}).data)

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SystemLog.objects.select_related("performed_by", "target_user").all()
    serializer_class = SystemLogSerializer
    permission_classes = [IsAdmin]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["action", "performed_by", "target_user"]
    ordering_fields = ["timestamp"]


class SystemSettingsView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAdminOrEmployee()]
        return [IsAdmin()]

    def get(self, request):
        obj = SystemSettings.get_settings()
        return Response(
            SystemSettingsSerializer(obj, context={"request": request}).data
        )

    def patch(self, request):
        obj = SystemSettings.get_settings()
        ser = SystemSettingsSerializer(
            obj, data=request.data, partial=True, context={"request": request}
        )
        ser.is_valid(raise_exception=True)
        ser.save(updated_by=request.user)
        SystemLog.log(
            action=SystemLog.Action.SETTINGS_UPDATED, performed_by=request.user
        )
        return Response(ser.data)

def _parse_date(date_str: str):
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def _parse_hhmm(hhmm: str) -> time:
    return datetime.strptime(hhmm, "%H:%M").time()


def _weekday_key(d) -> str:
    return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][d.weekday()]


class AvailabilitySlotsAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        employee_id = request.query_params.get("employee_id")
        service_id = request.query_params.get("service_id")
        date_str = request.query_params.get("date")

        if not employee_id or not service_id or not date_str:
            return Response(
                {
                    "detail": "Wymagane parametry: employee_id, service_id, date (YYYY-MM-DD)."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            employee = EmployeeProfile.objects.get(pk=int(employee_id), is_active=True)
        except (EmployeeProfile.DoesNotExist, ValueError, TypeError):
            return Response(
                {"detail": "Nie znaleziono pracownika."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            service = Service.objects.get(pk=int(service_id), is_active=True)
        except (Service.DoesNotExist, ValueError, TypeError):
            return Response(
                {"detail": "Nie znaleziono usługi."}, status=status.HTTP_404_NOT_FOUND
            )

        try:
            day = _parse_date(date_str)
        except (ValueError, TypeError):
            return Response(
                {"detail": "Nieprawidłowy format daty. Użyj YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.now().date()
        if day < today:
            return Response(
                {"detail": "Nie można rezerwować wizyt w przeszłości."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if TimeOff.objects.filter(
            employee=employee,
            status=TimeOff.Status.APPROVED,
            date_from__lte=day,
            date_to__gte=day,
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
        duration = timedelta(
            minutes=int(service.duration_minutes) + int(buffer_minutes)
        )

        day_start = timezone.make_aware(datetime.combine(day, time(0, 0)))
        day_end = timezone.make_aware(datetime.combine(day, time(23, 59, 59)))

        busy = list(
            Appointment.objects.filter(
                employee=employee,
                start__lt=day_end,
                end__gt=day_start,
                status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
            ).values_list("start", "end")
        )

        slots: list[dict] = []
        for p in periods:
            try:
                p_start = timezone.make_aware(
                    datetime.combine(day, _parse_hhmm(p.get("start", "")))
                )
                p_end = timezone.make_aware(
                    datetime.combine(day, _parse_hhmm(p.get("end", "")))
                )
            except (ValueError, TypeError, AttributeError):
                return Response(
                    {"detail": "Błędne dane grafiku pracownika."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            cursor = p_start
            while cursor + duration <= p_end:
                candidate_start = cursor
                candidate_end = cursor + duration

                if candidate_start < timezone.now():
                    cursor += timedelta(minutes=slot_minutes)
                    continue

                overlap = any(
                    b_start < candidate_end and b_end > candidate_start
                    for b_start, b_end in busy
                )
                if not overlap:
                    slots.append(
                        {
                            "start": candidate_start.isoformat(),
                            "end": candidate_end.isoformat(),
                        }
                    )

                cursor += timedelta(minutes=slot_minutes)

        return Response({"date": date_str, "slots": slots})


class BookingCreateAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        ser = BookingCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        appointment = ser.save()

        SystemLog.log(
            action=SystemLog.Action.APPOINTMENT_CREATED, performed_by=request.user
        )
        return Response(
            AppointmentSerializer(appointment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CheckAvailabilityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        employee_id = request.data.get("employee_id")
        service_id = request.data.get("service_id")
        start_str = request.data.get("start")

        if not all([employee_id, service_id, start_str]):
            return Response(
                {
                    "detail": "Wymagane pola: employee_id, service_id, start"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            employee = EmployeeProfile.objects.get(pk=int(employee_id), is_active=True)
        except (EmployeeProfile.DoesNotExist, ValueError, TypeError):
            return Response(
                {"available": False, "reason": "Nie znaleziono pracownika."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            service = Service.objects.get(pk=int(service_id), is_active=True)
        except (Service.DoesNotExist, ValueError, TypeError):
            return Response(
                {"available": False, "reason": "Nie znaleziono usługi."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            if timezone.is_naive(start):
                start = timezone.make_aware(start)
        except (ValueError, TypeError, AttributeError):
            return Response(
                {
                    "available": False,
                    "reason": "Nieprawidłowy format daty. Użyj ISO format.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if TimeOff.objects.filter(
            employee=employee,
            status=TimeOff.Status.APPROVED,
            date_from__lte=start.date(),
            date_to__gte=start.date(),
        ).exists():
            return Response(
                {"available": False, "reason": "Pracownik jest nieobecny w tym dniu."}
            )

        settings_obj = SystemSettings.get_settings()
        buffer_minutes = int(settings_obj.buffer_minutes)
        duration = timedelta(
            minutes=int(service.duration_minutes) + int(buffer_minutes)
        )
        end = start + duration

        conflicts = Appointment.objects.filter(
            employee=employee,
            start__lt=end,
            end__gt=start,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
        )

        if conflicts.exists():
            return Response(
                {
                    "available": False,
                    "reason": "Pracownik ma już zarezerwowaną wizytę w tym czasie.",
                }
            )

        return Response(
            {
                "available": True,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "duration_minutes": service.duration_minutes + buffer_minutes,
            }
        )

class DashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        if not hasattr(user, "role"):
            return Response(
                {"detail": "Brak roli użytkownika"}, status=status.HTTP_403_FORBIDDEN
            )

        role = user.role

        if role == "ADMIN":
            return self._admin_dashboard(request)
        if role == "EMPLOYEE":
            return self._employee_dashboard(request, user)
        if role == "CLIENT":
            return self._client_dashboard(request, user)

        return Response({"detail": "Brak uprawnień"}, status=status.HTTP_403_FORBIDDEN)

    def _admin_dashboard(self, request):
        today = timezone.now().date()
        now = timezone.now()

        today_appointments = Appointment.objects.filter(start__date=today)
        pending_count = Appointment.objects.filter(
            status=Appointment.Status.PENDING
        ).count()

        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_revenue = Appointment.objects.filter(
            status=Appointment.Status.COMPLETED,
            start__gte=month_start,
        ).aggregate(total=Sum("service__price"))["total"] or Decimal("0")

        active_employees = EmployeeProfile.objects.filter(is_active=True).count()
        active_clients = ClientProfile.objects.filter(is_active=True).count()

        return Response(
            {
                "role": "ADMIN",
                "today": {
                    "date": today.isoformat(),
                    "appointments_count": today_appointments.count(),
                    "appointments": AppointmentSerializer(
                        today_appointments.order_by("start")[:10],
                        many=True,
                        context={"request": request},
                    ).data,
                },
                "pending_appointments": pending_count,
                "current_month": {
                    "revenue": float(month_revenue),
                    "completed_appointments": Appointment.objects.filter(
                        status=Appointment.Status.COMPLETED,
                        start__gte=month_start,
                    ).count(),
                },
                "system": {
                    "active_employees": active_employees,
                    "active_clients": active_clients,
                    "active_services": Service.objects.filter(is_active=True).count(),
                },
            }
        )

    def _employee_dashboard(self, request, user):
        employee = getattr(user, "employee_profile", None)
        if not employee:
            return Response(
                {"detail": "Brak profilu pracownika."}, status=status.HTTP_404_NOT_FOUND
            )

        today = timezone.now()
        today_date = today.date()

        today_schedule = Appointment.objects.filter(
            employee=employee,
            start__date=today_date,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
        ).order_by("start")

        week_later = today + timedelta(days=7)
        upcoming = Appointment.objects.filter(
            employee=employee,
            start__gte=today,
            start__lte=week_later,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
        ).order_by("start")

        month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_completed = Appointment.objects.filter(
            employee=employee,
            status=Appointment.Status.COMPLETED,
            start__gte=month_start,
        ).count()

        return Response(
            {
                "role": "EMPLOYEE",
                "employee_number": employee.employee_number,
                "full_name": employee.get_full_name(),
                "today": {
                    "date": today_date.isoformat(),
                    "appointments": AppointmentSerializer(
                        today_schedule, many=True, context={"request": request}
                    ).data,
                },
                "upcoming": {
                    "count": upcoming.count(),
                    "appointments": AppointmentSerializer(
                        upcoming[:5], many=True, context={"request": request}
                    ).data,
                },
                "this_month": {
                    "completed_appointments": month_completed,
                },
            }
        )

    def _client_dashboard(self, request, user):
        client = getattr(user, "client_profile", None)
        if not client:
            return Response(
                {"detail": "Brak profilu klienta."}, status=status.HTTP_404_NOT_FOUND
            )

        now = timezone.now()

        upcoming = Appointment.objects.filter(
            client=client,
            start__gte=now,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
        ).order_by("start")

        history_count = Appointment.objects.filter(
            client=client, status=Appointment.Status.COMPLETED
        ).count()

        recent_history = Appointment.objects.filter(
            client=client,
            status=Appointment.Status.COMPLETED,
        ).order_by("-start")[:3]

        return Response(
            {
                "role": "CLIENT",
                "client_number": client.client_number,
                "full_name": client.get_full_name(),
                "upcoming_appointments": {
                    "count": upcoming.count(),
                    "appointments": AppointmentSerializer(
                        upcoming[:5], many=True, context={"request": request}
                    ).data,
                },
                "history": {
                    "total_completed": history_count,
                    "recent": AppointmentSerializer(
                        recent_history, many=True, context={"request": request}
                    ).data,
                },
            }
        )

class StatisticsView(APIView):

    permission_classes = [IsAdmin]

    def get(self, request):
        from django.db.models import Avg

        thirty_days_ago = timezone.now() - timedelta(days=30)
        now = timezone.now()

        total_appointments = Appointment.objects.count()

        recent_appointments = Appointment.objects.filter(start__gte=thirty_days_ago)

        appointments_last_30d = recent_appointments.count()
        completed_last_30d = recent_appointments.filter(
            status=Appointment.Status.COMPLETED
        ).count()
        cancelled_last_30d = recent_appointments.filter(
            status=Appointment.Status.CANCELLED
        ).count()
        no_shows_last_30d = recent_appointments.filter(
            status=Appointment.Status.NO_SHOW
        ).count()

        upcoming_appointments = Appointment.objects.filter(
            start__gte=now,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
        ).count()

        completed_recent = recent_appointments.filter(
            status=Appointment.Status.COMPLETED
        )

        revenue_last_30d = completed_recent.aggregate(total=Sum("service__price"))[
            "total"
        ] or Decimal("0")

        avg_appointment_value = completed_recent.aggregate(avg=Avg("service__price"))[
            "avg"
        ] or Decimal("0")

        total_revenue = Appointment.objects.filter(
            status=Appointment.Status.COMPLETED
        ).aggregate(total=Sum("service__price"))["total"] or Decimal("0")

        total_employees = EmployeeProfile.objects.count()
        active_employees = EmployeeProfile.objects.filter(is_active=True).count()

        employees_with_appointments = (
            EmployeeProfile.objects.filter(appointments__start__gte=thirty_days_ago)
            .distinct()
            .count()
        )

        total_clients = ClientProfile.objects.count()
        active_clients = ClientProfile.objects.filter(is_active=True).count()

        clients_with_appointments = (
            ClientProfile.objects.filter(appointments__start__gte=thirty_days_ago)
            .distinct()
            .count()
        )

        total_services = Service.objects.count()
        active_services = Service.objects.filter(is_active=True).count()
        popular_services = (
            Service.objects.filter(
                appointments__start__gte=thirty_days_ago,
                appointments__status=Appointment.Status.COMPLETED,
            )
            .annotate(booking_count=Count("appointments"), total_revenue=Sum("price"))
            .order_by("-booking_count")[:10]
        )

        return Response(
            {
                "appointments": {
                    "total_all_time": total_appointments,
                    "last_30_days": appointments_last_30d,
                    "completed_last_30d": completed_last_30d,
                    "cancelled_last_30d": cancelled_last_30d,
                    "no_shows_last_30d": no_shows_last_30d,
                    "upcoming": upcoming_appointments,
                },
                "revenue": {
                    "total_all_time": float(total_revenue),
                    "last_30_days": float(revenue_last_30d),
                    "avg_appointment_value": float(avg_appointment_value),
                },
                "employees": {
                    "total": total_employees,
                    "active": active_employees,
                    "with_appointments_last_30d": employees_with_appointments,
                },
                "clients": {
                    "total": total_clients,
                    "active": active_clients,
                    "with_appointments_last_30d": clients_with_appointments,
                },
                "services": {
                    "total": total_services,
                    "active": active_services,
                },
                "popular_services": [
                    {
                        "id": svc.id,
                        "name": svc.name,
                        "category": svc.category,
                        "booking_count": svc.booking_count,
                        "total_revenue": float(svc.total_revenue or 0),
                        "price": float(svc.price),
                    }
                    for svc in popular_services
                ],
            }
        )

class ReportView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, *args, **kwargs):
        report_type = kwargs.get("report_type")

        if report_type is None:
            return Response(
                {
                    "available_reports": [
                        {
                            "type": "employee-performance",
                            "description": "Wydajność pracowników",
                        },
                        {
                            "type": "revenue-analysis",
                            "description": "Analiza przychodów",
                        },
                        {
                            "type": "client-analytics",
                            "description": "Analityka klientów",
                        },
                        {"type": "operations", "description": "Raport operacyjny"},
                        {
                            "type": "capacity-utilization",
                            "description": "Wykorzystanie mocy",
                        },
                    ]
                }
            )

        if report_type == "employee-performance":
            return self._employee_performance_pdf()
        if report_type == "revenue-analysis":
            return self._revenue_analysis_pdf()
        if report_type == "client-analytics":
            return self._client_analytics_pdf()
        if report_type == "operations":
            return self._operations_pdf()
        if report_type == "capacity-utilization":
            return self._capacity_utilization_pdf()

        return Response(
            {"error": "Nieznany typ raportu."}, status=status.HTTP_400_BAD_REQUEST
        )

    def _register_fonts(self):

        font_path = os.path.join(settings.BASE_DIR, "static", "fonts", "DejaVuSans.ttf")

        try:
            pdfmetrics.registerFont(TTFont("DejaVuSans", font_path))
            return True
        except Exception as e:
            print(f"Warning: Could not register DejaVu font: {e}")
            return False

    def _build_pdf_response(self, title_text, data, filename, landscape_mode=False):
        from reportlab.platypus import (
            SimpleDocTemplate,
            Table,
            TableStyle,
            Paragraph,
            Spacer,
        )

        fonts_ok = self._register_fonts()
        font_name = "DejaVuSans" if fonts_ok else "Helvetica"

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
        elements = []
        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Title"],
            fontName=font_name,
            fontSize=16,
            textColor=colors.HexColor("#1976d2"),
            alignment=TA_CENTER,
        )

        elements.append(Paragraph(f"<b>{title_text}</b>", title_style))
        elements.append(Spacer(1, 12))
        table = Table(data, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1976d2")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("FONTNAME", (0, 0), (-1, -1), font_name),
                    ("FONTSIZE", (0, 0), (-1, 0), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
                    ("TOPPADDING", (0, 0), (-1, 0), 10),
                    ("FONTSIZE", (0, 1), (-1, -1), 9),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f5f5f5")],
                    ),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ]
            )
        )

        elements.append(table)
        doc.build(elements)

        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    def _employee_performance_pdf(self):

        since = timezone.now() - timedelta(days=30)
        until = timezone.now()

        employees = EmployeeProfile.objects.filter(is_active=True)

        data = [
            [
                "Pracownik",
                "Nr",
                "Wizyty",
                "Ukończone",
                "No-show",
                "Przychód",
                "No-show %",
                "Completion %",
            ]
        ]

        for emp in employees:
            appointments = Appointment.objects.filter(
                employee=emp, start__gte=since, start__lte=until
            )

            total = appointments.count()
            completed = appointments.filter(status=Appointment.Status.COMPLETED)
            completed_count = completed.count()
            no_shows = appointments.filter(status=Appointment.Status.NO_SHOW).count()

            revenue = completed.aggregate(total=Sum("service__price"))[
                "total"
            ] or Decimal("0")

            confirmed_total = appointments.filter(
                status__in=[
                    Appointment.Status.CONFIRMED,
                    Appointment.Status.COMPLETED,
                    Appointment.Status.NO_SHOW,
                ]
            ).count()
            no_show_rate = (
                (no_shows / confirmed_total * 100) if confirmed_total > 0 else 0
            )
            completion_rate = (completed_count / total * 100) if total > 0 else 0

            data.append(
                [
                    emp.get_full_name()[:25],
                    emp.employee_number,
                    str(total),
                    str(completed_count),
                    str(no_shows),
                    f"{float(revenue):.0f} zł",
                    f"{no_show_rate:.1f}%",
                    f"{completion_rate:.1f}%",
                ]
            )

        return self._build_pdf_response(
            title_text="Raport wydajności pracowników (ostatnie 30 dni)",
            data=data,
            filename="wydajnosc_pracownikow.pdf",
            landscape_mode=True,
        )

    def _revenue_analysis_pdf(self):
        from datetime import timedelta

        since = timezone.now() - timedelta(days=30)
        until = timezone.now()

        completed = Appointment.objects.filter(
            status=Appointment.Status.COMPLETED,
            start__gte=since,
            start__lte=until,
        )

        top_services = (
            completed.values("service__name", "service__category")
            .annotate(revenue=Sum("service__price"), count=Count("id"))
            .order_by("-revenue")[:10]
        )

        data = [["Usługa", "Kategoria", "Przychód", "Liczba wizyt"]]

        for svc in top_services:
            data.append(
                [
                    (svc["service__name"] or "-")[:40],
                    (svc["service__category"] or "-")[:20],
                    f"{float(svc['revenue'] or 0):.2f} zł",
                    str(svc["count"]),
                ]
            )

        return self._build_pdf_response(
            title_text="Analiza przychodów - Top 10 usług (ostatnie 30 dni)",
            data=data,
            filename="analiza_przychodow.pdf",
            landscape_mode=True,
        )

    def _client_analytics_pdf(self):
        from datetime import timedelta

        since = timezone.now() - timedelta(days=30)
        until = timezone.now()

        top_clients = (
            Appointment.objects.filter(
                status=Appointment.Status.COMPLETED,
                start__gte=since,
                start__lte=until,
            )
            .values("client__first_name", "client__last_name", "client__client_number")
            .annotate(revenue=Sum("service__price"), visits=Count("id"))
            .order_by("-revenue")[:20]
        )

        data = [["Klient", "Numer", "Przychód", "Liczba wizyt", "Średnia na wizytę"]]

        for client in top_clients:
            full_name = f"{client['client__first_name']} {client['client__last_name']}"
            avg = (
                (client["revenue"] or 0) / client["visits"]
                if client["visits"] > 0
                else 0
            )

            data.append(
                [
                    full_name[:30],
                    client["client__client_number"] or "-",
                    f"{float(client['revenue'] or 0):.2f} zł",
                    str(client["visits"]),
                    f"{float(avg):.2f} zł",
                ]
            )

        return self._build_pdf_response(
            title_text="Top 20 klientów (ostatnie 30 dni)",
            data=data,
            filename="top_klienci.pdf",
            landscape_mode=True,
        )

    def _operations_pdf(self):
        from datetime import timedelta

        since = timezone.now() - timedelta(days=30)
        until = timezone.now()

        appointments = Appointment.objects.filter(start__gte=since, start__lte=until)

        total = appointments.count()
        pending = appointments.filter(status=Appointment.Status.PENDING).count()
        confirmed = appointments.filter(status=Appointment.Status.CONFIRMED).count()
        completed = appointments.filter(status=Appointment.Status.COMPLETED).count()
        cancelled = appointments.filter(status=Appointment.Status.CANCELLED).count()
        no_shows = appointments.filter(status=Appointment.Status.NO_SHOW).count()

        data = [["Status", "Liczba", "Procent"]]

        status_list = [
            ("Oczekujące", pending),
            ("Potwierdzone", confirmed),
            ("Ukończone", completed),
            ("Anulowane", cancelled),
            ("Nieobecność", no_shows),
        ]

        for status_name, count in status_list:
            percentage = (count / total * 100) if total > 0 else 0
            data.append(
                [
                    status_name,
                    str(count),
                    f"{percentage:.1f}%",
                ]
            )

        return self._build_pdf_response(
            title_text="Raport operacyjny - Breakdown statusów (ostatnie 30 dni)",
            data=data,
            filename="raport_operacyjny.pdf",
            landscape_mode=False,
        )

    def _capacity_utilization_pdf(self):

        since = timezone.now() - timedelta(days=7)
        until = timezone.now()

        appointments = Appointment.objects.filter(
            start__gte=since,
            start__lte=until,
            status__in=[
                Appointment.Status.CONFIRMED,
                Appointment.Status.COMPLETED,
                Appointment.Status.NO_SHOW,
            ],
        )

        by_day = (
            appointments.annotate(day=ExtractWeekDay("start"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        day_names = [
            "Niedziela",
            "Poniedziałek",
            "Wtorek",
            "Środa",
            "Czwartek",
            "Piątek",
            "Sobota",
        ]

        data = [["Dzień tygodnia", "Liczba wizyt"]]

        for item in by_day:
            day_name = day_names[item["day"] - 1]
            data.append([day_name, str(item["count"])])

        return self._build_pdf_response(
            title_text="Wykorzystanie mocy - Według dnia tygodnia (ostatnie 7 dni)",
            data=data,
            filename="wykorzystanie_mocy.pdf",
            landscape_mode=False,
        )
