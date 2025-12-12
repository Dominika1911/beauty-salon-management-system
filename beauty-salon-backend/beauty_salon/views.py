from datetime import timedelta, datetime
from decimal import Decimal
from typing import Any, Optional, Dict, List, TYPE_CHECKING

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum, QuerySet
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.request import Request
from rest_framework.serializers import BaseSerializer

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status, permissions, serializers, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
# ============================================================================
# IMPORTY PERMISSIONS Z OSOBNEGO PLIKU
# ============================================================================

from .permissions import (
    IsManager,
    IsEmployee,
    IsClient,
    IsManagerOrEmployee,
    IsAppointmentParticipant,
    CanManageSchedule,
    CanApproveTimeOff,
    CanViewFinancials,
)

# Używamy typu User z CustomUser
User = get_user_model()

if TYPE_CHECKING:
    from .models import User as UserModel
else:
    UserModel = User

# ============================================================================
# IMPORTY MODELI
# ============================================================================

from .models import (
    Service,
    Employee,
    Schedule,
    TimeOff,
    Client,
    Appointment,
    Note,
    MediaAsset,
    Payment,
    Invoice,
    Notification,
    ReportPDF,
    AuditLog,
    SystemSettings,
    StatsSnapshot,
)

# ============================================================================
# IMPORTY SERIALIZERÓW
# ============================================================================

from .serializers import (
    # USER
    UserListSerializer,
    UserDetailSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    PasswordResetSerializer,
    PasswordChangeSerializer,
    # SERVICE
    ServiceListSerializer,
    ServiceDetailSerializer,
    ServiceCreateUpdateSerializer,
    # EMPLOYEE
    EmployeeSimpleSerializer,
    EmployeeListSerializer,
    EmployeeDetailSerializer,
    EmployeeCreateUpdateSerializer,
    # CLIENT
    ClientListSerializer,
    ClientDetailSerializer,
    ClientCreateUpdateSerializer,
    ClientSoftDeleteSerializer,
    # SCHEDULE & TIME OFF
    ScheduleSerializer,
    ScheduleUpdateSerializer,
    TimeOffSerializer,
    TimeOffApproveSerializer,
    # APPOINTMENTS
    AppointmentListSerializer,
    AppointmentDetailSerializer,
    AppointmentCreateSerializer,
    AppointmentStatusUpdateSerializer,
    # NOTES & MEDIA
    NoteSerializer,
    MediaAssetSerializer,
    # PAYMENTS & INVOICES
    PaymentSerializer,
    PaymentCreateSerializer,
    PaymentMarkAsPaidSerializer,
    InvoiceSerializer,
    # NOTIFICATIONS & REPORTS
    NotificationSerializer,
    NotificationCreateSerializer,
    ReportPDFSerializer,
    # AUDIT / SYSTEM / STATS
    AuditLogSerializer,
    SystemSettingsSerializer,
    StatsSnapshotSerializer,
    ServiceStatisticsSerializer,
    EmployeeStatisticsSerializer,
)


# ============================================================================
# AUDIT LOG HELPER
# ============================================================================


def create_audit_log(
        user: Any,
        type: str,
        message: str,
        entity: Any = None,
        request: Optional[Request] = None,
        level: str = AuditLog.Level.INFO,
        metadata: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """Prosty helper do tworzenia wpisów w AuditLog."""
    user_fk = user if user and user.is_authenticated else None

    return AuditLog.objects.create(
        type=type,
        level=level,
        user=user_fk,
        message=message,
        adres_ip=(request.META.get("REMOTE_ADDR") if request else None),
        user_agent=(request.META.get("HTTP_USER_AGENT", "") if request else ""),
        entity_type=entity.__class__.__name__ if entity is not None else "",
        entity_id=str(entity.pk) if entity is not None else "",
        metadata=metadata or {},
    )


# ==================== USER VIEWS ====================


class UserViewSet(viewsets.ModelViewSet):
    """
    Zarządzanie użytkownikami systemu.

    - Manager: pełny dostęp (lista, tworzenie, edycja, reset hasła)
    - Każdy zalogowany: endpoint `me` + `change_password`
    """

    queryset = User.objects.all()
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["role", "is_active", "is_staff"]
    ordering_fields = ["created_at", "email", "role"]
    ordering = ["-created_at"]

    def get_serializer_class(self) -> type[BaseSerializer[Any]]:
        if self.action == "list":
            return UserListSerializer
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ["update", "partial_update"]:
            return UserUpdateSerializer
        return UserDetailSerializer

    def get_permissions(self) -> List[permissions.BasePermission]:
        if self.action in ["me", "change_password"]:
            return [permissions.IsAuthenticated()]
        if self.action == "reset_password":
            return [IsManager()]
        return [IsManager()]

    @action(detail=False, methods=["get"])
    def me(self, request: Request) -> Response:
        """Zwraca dane zalogowanego użytkownika."""
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def reset_password(self, request: Request, pk: Optional[int] = None) -> Response:
        """Reset hasła wskazanego użytkownika (tylko manager)."""
        user = self.get_object()
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_password = serializer.validated_data["new_password"]

        user.set_password(new_password)
        user.failed_login_attempts = 0
        user.account_locked_until = None
        user.save(update_fields=["password", "failed_login_attempts", "account_locked_until"])

        create_audit_log(
            user=request.user,
            type="user.reset_password",
            message=f"Reset hasła dla użytkownika {user.email}",
            entity=user,
            request=request,
        )

        return Response({"detail": "Hasło zostało zresetowane."})

    @action(detail=False, methods=["post"])
    def change_password(self, request: Request) -> Response:
        """Zmiana własnego hasła."""
        serializer = PasswordChangeSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        new_password = serializer.validated_data["new_password"]
        user = request.user

        if not user.is_authenticated:
            return Response({"detail": "User not authenticated."}, status=status.HTTP_401_UNAUTHORIZED)

        user.set_password(new_password)
        user.failed_login_attempts = 0
        user.account_locked_until = None
        user.save(
            update_fields=["password", "failed_login_attempts", "account_locked_until"])

        create_audit_log(
            user=user,
            type="user.change_password",
            message="Użytkownik zmienił własne hasło.",
            entity=user,
            request=request,
        )

        return Response({"detail": "Hasło zostało zmienione."})


# ==================== SERVICE VIEWS ====================


class ServiceViewSet(viewsets.ModelViewSet):
    """
    Usługi salonu.

    - Lista / szczegóły: dostępne dla wszystkich (publiczny katalog usług)
    - Tworzenie/edycja/usuwanie: manager lub pracownik
    """

    queryset = Service.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["category", "is_published"]
    search_fields = ["name", "description", "category"]
    ordering_fields = ["category", "name", "price", "created_at", "reservations_count"]
    ordering = ["category", "name"]

    def get_serializer_class(self) -> type[BaseSerializer[Any]]:
        if self.action == "list":
            return ServiceListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return ServiceCreateUpdateSerializer
        return ServiceDetailSerializer

    def get_permissions(self) -> List[permissions.BasePermission]:
        if self.action in ["list", "retrieve", "published"]:
            return [permissions.AllowAny()]
        return [IsManagerOrEmployee()]

    def get_queryset(self) -> QuerySet[Service]:
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated or (
                hasattr(user, "is_client")
                and getattr(user, "is_client", False)
        ):
            return queryset.filter(is_published=True)
        return queryset

    @action(detail=False, methods=["get"])
    def published(self, request: Request) -> Response:
        """Lista tylko opublikowanych usług."""
        qs = self.filter_queryset(
            self.get_queryset().filter(is_published=True)
        )
        serializer = ServiceListSerializer(qs, many=True)
        return Response(serializer.data)


# ==================== EMPLOYEE VIEWS ====================


class EmployeeViewSet(viewsets.ModelViewSet):
    """
    Pracownicy salonu.

    - Publicznie: lista / szczegóły (np. do wyboru w rezerwacji)
    - Tworzenie/edycja/usuwanie: tylko manager
    """

    queryset = (
        Employee.objects.all()
        .select_related("user")
        .prefetch_related("skills")
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active"]
    search_fields = [
        "first_name",
        "last_name",
        "number",
        "phone",
        "user__email",
    ]
    ordering_fields = ["last_name", "number", "hired_at", "appointments_count"]
    ordering = ["last_name", "first_name"]

    def get_serializer_class(self) -> type[BaseSerializer[Any]]:
        if self.action == "list":
            return EmployeeListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return EmployeeCreateUpdateSerializer
        return EmployeeDetailSerializer

    def get_permissions(self) -> List[permissions.BasePermission]:
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsManager()]
        if self.action in ["me", "upcoming_appointments", "services"]:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    @action(detail=False, methods=["get"])
    def active(self, request: Request) -> Response:
        """Lista aktywnych pracowników."""
        qs = self.filter_queryset(self.get_queryset().filter(is_active=True))
        serializer = EmployeeListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def me(self, request: Request) -> Response:
        """Dane pracownika powiązanego z zalogowanym użytkownikiem."""
        user = request.user
        if not user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            employee = user.employee
        except Employee.DoesNotExist:
            return Response(
                {"detail": "Konto nie jest powiązane z pracownikiem."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = EmployeeDetailSerializer(employee)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def services(self, request: Request, pk: Optional[int] = None) -> Response:
        """Usługi wykonywane przez pracownika."""
        employee = self.get_object()
        serializer = ServiceListSerializer(employee.skills.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def upcoming_appointments(self, request: Request, pk: Optional[int] = None) -> Response:
        """Najbliższe wizyty danego pracownika."""
        employee = self.get_object()
        now = timezone.now()
        qs = Appointment.objects.filter(
            employee=employee,
            start__gte=now,
        ).order_by("start")[:50]
        serializer = AppointmentListSerializer(qs, many=True)
        return Response(serializer.data)


# ==================== CLIENT VIEWS ====================


class ClientViewSet(viewsets.ModelViewSet):
    """
    Klienci salonu.

    - Manager/pracownik: pełne zarządzanie klientami
    - Klient: dostęp do własnego profilu przez `me` oraz `my_appointments`
    """

    queryset = Client.objects.select_related("user").all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["marketing_consent", "preferred_contact", "deleted_at", "email"]
    search_fields = [
        "first_name",
        "last_name",
        "email",
        "phone",
        "number",
        "user__email",
    ]
    ordering_fields = [
        "created_at",
        "last_name",
        "visits_count",
        "total_spent_amount",
    ]
    ordering = ["last_name", "first_name"]

    def get_serializer_class(self) -> type[BaseSerializer[Any]]:
        if self.action == "list":
            return ClientListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return ClientCreateUpdateSerializer
        if self.action == "soft_delete":
            return ClientSoftDeleteSerializer
        return ClientDetailSerializer

    def get_permissions(self) -> List[permissions.BasePermission]:
        if self.action in ["me", "my_appointments"]:
            return [permissions.IsAuthenticated()]
        if self.action == "soft_delete":
            return [IsManagerOrEmployee()]
        return [IsManagerOrEmployee()]

    def get_queryset(self) -> QuerySet[Client]:
        qs = super().get_queryset()
        user = self.request.user

        # Manager/pracownik – wszyscy klienci
        if (
                user.is_authenticated
                and (
                (hasattr(user, "is_manager") and getattr(user, "is_manager", False))
                or (
                        hasattr(user, "is_employee")
                        and getattr(user, "is_employee", False)
                )
        )
        ):
            return qs

        # Klient – tylko własny rekord
        if (
                user.is_authenticated
                and hasattr(user, "is_client")
                and getattr(user, "is_client", False)
        ):
            try:
                client = user.client_profile
            except Client.DoesNotExist:
                return qs.none()
            return qs.filter(user=user)

        return qs.none()

    @action(detail=False, methods=["get"])
    def me(self, request: Request) -> Response:
        """Profil klienta powiązanego z zalogowanym użytkownikiem."""
        user = request.user
        if not user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            client = user.client_profile
        except Client.DoesNotExist:
            return Response(
                {"detail": "Konto nie jest powiązane z klientem."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ClientDetailSerializer(client)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def soft_deleted(self, request: Request) -> Response:
        """Lista miękko usuniętych klientów (tylko personel)."""
        qs = Client.objects.filter(deleted_at__isnull=False)
        serializer = ClientListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def soft_delete(self, request: Request) -> Response:
        """Miękkie usunięcie klienta (tylko personel)."""
        serializer = ClientSoftDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        client = serializer.save()

        create_audit_log(
            user=request.user,
            type="client.soft_delete",
            message=f"Miękko usunięto klienta {client.get_full_name()}",
            entity=client,
            request=request,
        )

        return Response(
            {"detail": "Klient został oznaczony jako usunięty."},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"])
    def appointments(self, request: Request, pk: Optional[int] = None) -> Response:
        """Lista wizyt konkretnego klienta."""
        client = self.get_object()
        qs = Appointment.objects.filter(client=client).order_by("-start")
        serializer = AppointmentListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def my_appointments(self, request: Request) -> Response:
        """Wizyty zalogowanego klienta."""
        user = request.user
        if not user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            client = user.client_profile
        except Client.DoesNotExist:
            return Response(
                {"detail": "Konto nie jest powiązane z klientem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = Appointment.objects.filter(client=client).order_by("-start")
        serializer = AppointmentListSerializer(qs, many=True)
        return Response(serializer.data)


# ==================== SCHEDULE VIEWS ====================


class ScheduleViewSet(viewsets.ModelViewSet):
    """
    Grafiki pracy pracowników.

    - Manager/pracownik: pełny dostęp
    """

    queryset = Schedule.objects.select_related("employee").all()
    serializer_class = ScheduleSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["employee", "status"]
    ordering_fields = ["created_at", "updated_at"]
    ordering = ["-created_at"]

    def get_permissions(self) -> List[permissions.BasePermission]:
        return [IsManagerOrEmployee()]

    def get_queryset(self) -> QuerySet[Schedule]:
        qs = super().get_queryset()
        user = self.request.user

        if (
                user.is_authenticated
                and hasattr(user, "is_manager")
                and getattr(user, "is_manager", False)
        ):
            return qs

        if (
                user.is_authenticated
                and hasattr(user, "is_employee")
                and getattr(user, "is_employee", False)
        ):
            return qs.filter(employee__user=user)

        return qs.none()

    @action(detail=False, methods=["get"])
    def my_schedule(self, request: Request) -> Response:
        """Grafiki zalogowanego pracownika."""
        user = request.user
        if not user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            employee = user.employee
        except Employee.DoesNotExist:
            return Response(
                {"detail": "Konto nie jest powiązane z pracownikiem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = Schedule.objects.filter(employee=employee)
        serializer = ScheduleSerializer(qs, many=True)
        return Response(serializer.data)

class EmployeeScheduleUpdateView(APIView):
    permission_classes = [CanManageSchedule]

    def get(self, request, employee_id: int):
        """
        Pobierz grafik pracownika
        """
        employee = get_object_or_404(Employee, pk=employee_id)

        schedule = Schedule.objects.filter(employee=employee).first()

        if not schedule:
            # Zwróć pusty grafik zamiast 404
            return Response(
                {
                    "id": None,
                    "employee": employee_id,
                    "availability_periods": [],
                    "breaks": [],
                    "status": "active",
                },
                status=status.HTTP_200_OK,
            )

        serializer = ScheduleSerializer(schedule)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, employee_id: int):
        """
        Zapisz / zaktualizuj grafik pracownika
        """
        employee = get_object_or_404(Employee, pk=employee_id)

        schedule, _ = Schedule.objects.get_or_create(
            employee=employee,
            defaults={
                "availability_periods": [],
                "breaks": [],
                "status": "active",
            },
        )

        serializer = ScheduleUpdateSerializer(
            schedule,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            ScheduleSerializer(schedule).data,
            status=status.HTTP_200_OK,
        )


# ==================== TIME OFF VIEWS ====================


class TimeOffViewSet(viewsets.ModelViewSet):
    """
    Urlopy / nieobecności pracowników.

    - Manager/pracownik: przegląd
    - Zatwierdzanie: tylko manager
    """

    queryset = TimeOff.objects.select_related("employee", "approved_by").all()
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["employee", "status", "type", "date_from", "date_to"]
    ordering_fields = ["date_from", "created_at"]
    ordering = ["-date_from"]

    def get_serializer_class(self) -> type[BaseSerializer[Any]]:
        if self.action == "approve":
            return TimeOffApproveSerializer
        return TimeOffSerializer

    def get_permissions(self) -> List[permissions.BasePermission]:
        if self.action == "approve":
            return [IsManager()]
        return [IsManagerOrEmployee()]

    def get_queryset(self) -> QuerySet[TimeOff]:
        qs = super().get_queryset()
        user = self.request.user

        if (
                user.is_authenticated
                and hasattr(user, "is_manager")
                and getattr(user, "is_manager", False)
        ):
            return qs

        if (
                user.is_authenticated
                and hasattr(user, "is_employee")
                and getattr(user, "is_employee", False)
        ):
            return qs.filter(employee__user=user)

        return qs.none()

    @action(detail=False, methods=["get"])
    def my_time_off(self, request: Request) -> Response:
        """Urlopy zalogowanego pracownika."""
        user = request.user
        if not user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            employee = user.employee
        except Employee.DoesNotExist:
            return Response(
                {"detail": "Konto nie jest powiązane z pracownikiem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = TimeOff.objects.filter(employee=employee)
        serializer = TimeOffSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def approve(self, request: Request) -> Response:
        """
        Zatwierdzanie wniosku urlopowego (manager).
        """
        serializer = TimeOffApproveSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        time_off = serializer.save()

        create_audit_log(
            user=request.user,
            type="timeoff.approve",
            message=f"Zmiana statusu urlopu ID={time_off.id} na {time_off.get_status_display()}",
            entity=time_off,
            request=request,
        )

        return Response(TimeOffSerializer(time_off).data)


# ==================== APPOINTMENT VIEWS ====================


class AppointmentViewSet(viewsets.ModelViewSet):
    """
    Wizyty w salonie.

    - Manager/pracownik: wszystkie wizyty (tworzenie, edycja, zmiana statusu)
    - Klient: tylko własne wizyty (przez list / retrieve)
    """

    queryset = (
        Appointment.objects.select_related("client", "employee", "service")
        .all()
    )
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status", "employee", "client", "service"]
    ordering_fields = ["start", "created_at"]
    ordering = ["-start"]

    def get_serializer_class(self) -> type[BaseSerializer[Any]]:
        if self.action == "list":
            return AppointmentListSerializer
        if self.action == "create":
            return AppointmentCreateSerializer
        if self.action in ["update", "partial_update"]:
            return AppointmentCreateSerializer
        if self.action == "change_status":
            return AppointmentStatusUpdateSerializer
        return AppointmentDetailSerializer

    def get_permissions(self) -> List[permissions.BasePermission]:
        if self.action in ["change_status", "destroy"]:
            return [IsManagerOrEmployee()]
        if self.action in ["create", "update", "partial_update"]:
            return [IsManagerOrEmployee()]
        if self.action in ["my_appointments", "today", "upcoming"]:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self) -> QuerySet[Appointment]:
        qs = super().get_queryset()
        user = self.request.user

        # Filtrowanie po dacie z query params (date_from, date_to)
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if date_from:
            d_from = parse_date(date_from)
            if d_from:
                qs = qs.filter(start__date__gte=d_from)

        if date_to:
            d_to = parse_date(date_to)
            if d_to:
                qs = qs.filter(start__date__lte=d_to)

        if not user.is_authenticated:
            return qs.none()

        # Manager/pracownik – wszystkie wizyty
        if (
                hasattr(user, "is_manager")
                and getattr(user, "is_manager", False)
        ) or (
                hasattr(user, "is_employee")
                and getattr(user, "is_employee", False)
        ):
            return qs

        # Klient – tylko własne
        if hasattr(user, "is_client") and getattr(user, "is_client", False):
            try:
                client = user.client_profile
            except Client.DoesNotExist:
                return qs.none()
            return qs.filter(client=client)

        return qs.none()

    @action(detail=False, methods=["get"])
    def today(self, request: Request) -> Response:
        """Wizyty dzisiaj (filtrowane po roli użytkownika)."""
        today = timezone.localdate()
        qs = self.get_queryset().filter(start__date=today).order_by("start")
        serializer = AppointmentListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def upcoming(self, request: Request) -> Response:
        """Przyszłe wizyty (domyślnie od teraz)."""
        now = timezone.now()
        qs = self.get_queryset().filter(start__gte=now).order_by("start")
        serializer = AppointmentListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def my_appointments(self, request: Request) -> Response:
        """Wizyty zalogowanego użytkownika (klient/pracownik)."""
        user = request.user
        if not user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if hasattr(user, "is_client") and getattr(user, "is_client", False):
            try:
                client = user.client_profile
            except Client.DoesNotExist:
                return Response(
                    {"detail": "Konto nie jest powiązane z klientem."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            qs = Appointment.objects.filter(client=client).order_by("-start")
        elif hasattr(user, "is_employee") and getattr(user, "is_employee", False):
            try:
                employee = user.employee
            except Employee.DoesNotExist:
                return Response(
                    {"detail": "Konto nie jest powiązane z pracownikiem."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            qs = Appointment.objects.filter(employee=employee).order_by("-start")
        else:
            qs = Appointment.objects.none()

        serializer = AppointmentListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def change_status(self, request: Request, pk: Optional[int] = None) -> Response:
        """
        Zmiana statusu wizyty (np. anulowanie, no-show).
        Wprowadza logikę utraty zaliczki.
        """
        appointment = self.get_object()
        serializer = AppointmentStatusUpdateSerializer(
            appointment,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        old_status = appointment.status
        new_status = serializer.validated_data.get("status")

        # Statusy, przy których następuje utrata zaliczki (kara)
        FORFEIT_STATUSES = [
            Appointment.Status.CANCELLED,
            Appointment.Status.NO_SHOW,
        ]

        if new_status in FORFEIT_STATUSES and old_status not in FORFEIT_STATUSES:
            settings = SystemSettings.load()
            should_forfeit = settings.deposit_policy.get(
                "forfeit_deposit_on_cancellation", False
            )

            if should_forfeit:
                try:
                    deposits: QuerySet[Payment] = Payment.objects.filter(
                        appointment=appointment,
                        status=Payment.Status.DEPOSIT,
                    )

                    deposit_count = deposits.count()

                    if deposit_count > 0:
                        deposit: Optional[Payment] = deposits.order_by(
                            "-created_at"
                        ).first()

                        if deposit is not None:
                            deposit.status = Payment.Status.FORFEITED
                            deposit.paid_at = timezone.now()
                            deposit.save(update_fields=["status", "paid_at"])

                            create_audit_log(
                                user=request.user,
                                type="payment.deposit_forfeited",
                                message=(
                                    f"Zaliczka (ID={deposit.id}, kwota={deposit.amount}) "
                                    f"utracona z powodu: {appointment.get_status_display()} "
                                    f"wizyty ID={appointment.id}. "
                                    f"{'(Wybrano najnowszą z ' + str(deposit_count) + ' zaliczek)' if deposit_count > 1 else ''}"
                                ),
                                level=AuditLog.Level.WARNING,
                                entity=deposit,
                                request=request,
                            )

                            if deposit_count > 1:
                                create_audit_log(
                                    user=request.user,
                                    type="payment.multiple_deposits_warning",
                                    message=(
                                        f"Wizyta ID={appointment.id} miała {deposit_count} zaliczek. "
                                        f"Utracono tylko najnowszą (ID={deposit.id})."
                                    ),
                                    level=AuditLog.Level.WARNING,
                                    entity=appointment,
                                    request=request,
                                )

                except Exception as e:
                    create_audit_log(
                        user=request.user,
                        type="payment.forfeit_error",
                        message=(
                            f"Błąd utraty zaliczki dla wizyty {appointment.id}: {str(e)}"
                        ),
                        level=AuditLog.Level.ERROR,
                        entity=appointment,
                        request=request,
                    )

        # Zapisujemy nowy status wizyty (niezależnie od zaliczki)
        appointment = serializer.save()

        create_audit_log(
            user=request.user,
            type="appointment.change_status",
            message=(
                f"Zmiana statusu wizyty ID={appointment.id} "
                f"z {old_status} na {new_status}"
            ),
            entity=appointment,
            request=request,
        )

        return Response(AppointmentDetailSerializer(appointment).data)


# ==================== NOTE & MEDIA VIEWS ====================

class NoteViewSet(viewsets.ModelViewSet):
    """
    Notatki do wizyt.

    - Tworzenie/edycja/usuwanie: personel
    - Klient: widzi tylko notatki widoczne dla klienta przy swoich wizytach
    """

    queryset = Note.objects.select_related("appointment", "author").all()
    serializer_class = NoteSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["appointment", "visible_for_client"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_permissions(self) -> List[permissions.BasePermission]:
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsManagerOrEmployee()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self) -> QuerySet[Note]:
        qs = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return qs.none()

        if (
                hasattr(user, "is_manager")
                and getattr(user, "is_manager", False)
        ) or (
                hasattr(user, "is_employee")
                and getattr(user, "is_employee", False)
        ):
            return qs

        if hasattr(user, "is_client") and getattr(user, "is_client", False):
            try:
                client = user.client_profile
            except Client.DoesNotExist:
                return qs.none()
            return qs.filter(
                appointment__client=client,
                visible_for_client=True,
            )

        return qs.none()

    @action(detail=False, methods=["get"])
    def my_notes(self, request: Request) -> Response:
        """Notatki stworzone przez zalogowanego użytkownika (dla personelu)."""
        user = request.user
        if not user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        qs = Note.objects.filter(author=user).order_by("-created_at")
        serializer = NoteSerializer(qs, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer: BaseSerializer[Any]) -> None:
        serializer.save(author=self.request.user)


class MediaAssetViewSet(viewsets.ModelViewSet):
    """
    Materiały (portfolio, zdjęcia efektów itd.).

    - Podgląd: dla wszystkich
    - Tworzenie/edycja/usuwanie: manager/pracownik
    """

    queryset = MediaAsset.objects.select_related("employee").all()
    serializer_class = MediaAssetSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["employee", "type", "is_active"]
    search_fields = [
        "file_name",
        "description",
        "employee__first_name",
        "employee__last_name",
    ]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_permissions(self) -> List[permissions.BasePermission]:
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsManagerOrEmployee()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer: BaseSerializer[Any]) -> None:
        """
        Jeśli dodaje pracownik – automatycznie przypisujemy jego profil Employee.
        Manager może wskazać dowolnego pracownika.
        """
        user = self.request.user
        if not user.is_authenticated:
            raise serializers.ValidationError("Użytkownik nie jest zalogowany.")

        if (
                hasattr(user, "is_employee")
                and getattr(user, "is_employee", False)
                and not (hasattr(user, "is_manager") and getattr(user, "is_manager", False))
        ):
            try:
                employee = user.employee
            except Employee.DoesNotExist:
                raise serializers.ValidationError(
                    "Konto nie jest powiązane z pracownikiem."
                )
            serializer.save(employee=employee)
        else:
            serializer.save()

# ==================== PAYMENT & INVOICE VIEWS ====================

class PaymentViewSet(viewsets.ModelViewSet):
    """
    Płatności za wizyty.

    - Personel: widzi wszystkie płatności, może je tworzyć i oznaczać jako zapłacone
    - Klient: widzi tylko swoje płatności
    """

    queryset = Payment.objects.select_related(
        "appointment", "appointment__client"
    ).all()
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status", "method", "type", "appointment", "appointment__client", "amount"]
    ordering_fields = ["created_at", "paid_at", "amount"]
    ordering = ["-created_at"]

    def get_serializer_class(self) -> type[BaseSerializer[Any]]:
        if self.action == "create":
            return PaymentCreateSerializer
        if self.action == "mark_as_paid":
            return PaymentMarkAsPaidSerializer
        return PaymentSerializer

    def get_permissions(self) -> List[permissions.BasePermission]:
        if self.action in ["create", "mark_as_paid", "update", "partial_update", "destroy"]:
            return [IsManagerOrEmployee()]
        if self.action in ["list", "retrieve", "my_payments"]:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self) -> QuerySet[Payment]:
        qs = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return qs.none()

        if (
                hasattr(user, "is_manager")
                and getattr(user, "is_manager", False)
        ) or (
                hasattr(user, "is_employee")
                and getattr(user, "is_employee", False)
        ):
            return qs

        if hasattr(user, "is_client") and getattr(user, "is_client", False):
            try:
                client = user.client_profile
            except Client.DoesNotExist:
                return qs.none()
            return qs.filter(appointment__client=client)

        return qs.none()

    @action(detail=False, methods=["get"])
    def my_payments(self, request: Request) -> Response:
        """Płatności zalogowanego klienta."""
        qs = self.get_queryset()
        serializer = PaymentSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def mark_as_paid(self, request: Request) -> Response:
        """
        Oznacz wybraną płatność jako zapłaconą.
        """
        serializer = PaymentMarkAsPaidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()

        create_audit_log(
            user=request.user,
            type="payment.mark_as_paid",
            message=f"Płatność ID={payment.id} oznaczona jako zapłacona.",
            entity=payment,
            request=request,
        )

        return Response(
            {
                "detail": "Płatność oznaczona jako zapłacona.",
                "payment": PaymentSerializer(payment).data,
            }
        )

class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Faktury.

    - Personel: widzi wszystkie
    - Klient: widzi tylko własne faktury
    """

    queryset = Invoice.objects.select_related("client", "appointment").all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsManager]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["client", "is_paid", "issue_date", "due_date"]
    ordering_fields = ["issue_date", "due_date", "gross_amount", "created_at"]
    ordering = ["-issue_date"]

    def get_permissions(self) -> List[permissions.BasePermission]:
        return [permissions.IsAuthenticated()]

    def get_queryset(self) -> QuerySet[Invoice]:
        qs = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return qs.none()

        if (
                hasattr(user, "is_manager")
                and getattr(user, "is_manager", False)
        ) or (
                hasattr(user, "is_employee")
                and getattr(user, "is_employee", False)
        ):
            return qs

        if hasattr(user, "is_client") and getattr(user, "is_client", False):
            try:
                client = user.client_profile
            except Client.DoesNotExist:
                return qs.none()
            return qs.filter(client=client)

        return qs.none()

    @action(detail=False, methods=["get"])
    def my_invoices(self, request: Request) -> Response:
        """Faktury zalogowanego klienta."""
        qs = self.get_queryset()
        serializer = InvoiceSerializer(qs, many=True)
        return Response(serializer.data)

# ==================== NOTIFICATION & REPORT VIEWS ====================
class NotificationViewSet(viewsets.ModelViewSet):
    """
    Powiadomienia (np. przypomnienia o wizycie).

    - Personel: zarządza powiadomieniami
    - Klient: widzi tylko swoje powiadomienia
    """

    queryset = Notification.objects.select_related(
        "client", "appointment"
    ).all()
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["client", "type", "channel", "status"]
    ordering_fields = ["scheduled_at", "created_at"]
    ordering = ["-scheduled_at"]

    def get_serializer_class(self) -> type[BaseSerializer[Any]]:
        if self.action == "create":
            return NotificationCreateSerializer
        return NotificationSerializer

    def get_permissions(self) -> List[permissions.BasePermission]:
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsManagerOrEmployee()]
        if self.action in ["list", "retrieve", "my_notifications"]:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self) -> QuerySet[Notification]:
        qs = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return qs.none()

        if (
                hasattr(user, "is_manager")
                and getattr(user, "is_manager", False)
        ) or (
                hasattr(user, "is_employee")
                and getattr(user, "is_employee", False)
        ):
            return qs

        if hasattr(user, "is_client") and getattr(user, "is_client", False):
            try:
                client = user.client_profile
            except Client.DoesNotExist:
                return qs.none()
            return qs.filter(client=client)

        return qs.none()

    @action(detail=False, methods=["get"])
    def my_notifications(self, request: Request) -> Response:
        """Powiadomienia zalogowanego klienta."""
        qs = self.get_queryset()
        serializer = NotificationSerializer(qs, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer: BaseSerializer[Any]) -> None:
        serializer.save()

class ReportPDFViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Wygenerowane raporty PDF (tylko manager).
    """

    queryset = ReportPDF.objects.select_related("generated_by").all()
    serializer_class = ReportPDFSerializer
    permission_classes = [IsManager]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["type", "created_at", "generated_by"]
    ordering_fields = ["created_at", "file_size"]
    ordering = ["-created_at"]

    def get_permissions(self) -> List[permissions.BasePermission]:
        return [IsManager()]

    def get_queryset(self) -> QuerySet[ReportPDF]:
        return super().get_queryset()

# ==================== AUDIT LOG & SYSTEM SETTINGS ====================

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Logi audytowe systemu (tylko manager).
    """

    queryset = AuditLog.objects.select_related("user").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsManager]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["type", "level", "user", "created_at"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_permissions(self) -> List[permissions.BasePermission]:
        return [IsManager()]

    def get_queryset(self) -> QuerySet[AuditLog]:
        return super().get_queryset()

class SystemSettingsView(APIView):
    """
    Ustawienia systemowe (tylko manager).
    """

    permission_classes = [IsManager]

    def get(self, request: Request) -> Response:
        """Pobierz aktualne ustawienia systemowe."""
        settings = SystemSettings.load()
        serializer = SystemSettingsSerializer(settings)
        return Response(serializer.data)

    def patch(self, request: Request) -> Response:
        """Aktualizacja ustawień (tylko manager)."""
        user = request.user

        settings = SystemSettings.load()
        serializer = SystemSettingsSerializer(
            settings,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(last_modified_by=user)

        create_audit_log(
            user=user,
            type="system_settings.update",
            message="Aktualizacja ustawień systemowych.",
            entity=settings,
            request=request,
        )

        return Response(serializer.data)

# ==================== STATS SNAPSHOT VIEWS ====================

class StatsSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Zapisane zrzuty statystyk (np. nocne batch'e).
    """

    queryset = StatsSnapshot.objects.all()
    serializer_class = StatsSnapshotSerializer
    permission_classes = [IsManagerOrEmployee]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["period", "date_from", "date_to"]
    ordering_fields = ["date_from", "date_to", "created_at"]
    ordering = ["-created_at"]

    def get_permissions(self) -> List[permissions.BasePermission]:
        return [IsManagerOrEmployee()]

    def get_queryset(self) -> QuerySet[StatsSnapshot]:
        return super().get_queryset()

# ==================== STATISTICS VIEW ====================

class StatisticsView(APIView):
    """
    Globalne statystyki salonu (wizyty, przychody, usługi, pracownicy).

    Domyślny okres: ostatnie 30 dni (parametr ?days=).
    """

    permission_classes = [IsManagerOrEmployee]

    def get(self, request: Request) -> Response:
        days_param = request.query_params.get("days", "30")
        try:
            days = int(days_param)
        except ValueError:
            days = 30

        now = timezone.now()
        since = now - timedelta(days=days)

        total_clients = Client.objects.filter(deleted_at__isnull=True).count()
        new_clients = (
            Client.objects.filter(
                created_at__gte=since,
                deleted_at__isnull=True,
            ).count()
        )
        total_appointments = Appointment.objects.count()
        completed_appointments = Appointment.objects.filter(
            status=Appointment.Status.COMPLETED
        ).count()
        cancelled_appointments = Appointment.objects.filter(
            status=Appointment.Status.CANCELLED
        ).count()
        no_show_appointments = Appointment.objects.filter(
            status=Appointment.Status.NO_SHOW
        ).count()

        total_revenue = (
                Payment.objects.filter(
                    status__in=[Payment.Status.PAID, Payment.Status.DEPOSIT],
                    created_at__gte=since,
                ).aggregate(total=Sum("amount"))["total"]
                or Decimal("0.00")
        )

        services_qs = (
            Service.objects.filter(is_published=True)
            .annotate(
                total_appointments=Count(
                    "appointments",
                    filter=Q(appointments__start__gte=since),
                ),
                total_revenue=Sum(
                    "appointments__payments__amount",
                    filter=Q(
                        appointments__payments__status__in=[
                            Payment.Status.PAID,
                            Payment.Status.DEPOSIT,
                        ],
                        appointments__payments__created_at__gte=since,
                    ),
                ),
            )
            .order_by("-total_appointments")
        )

        service_stats_data = [
            {
                "service": service,
                "total_appointments": service.total_appointments or 0,
                "total_revenue": service.total_revenue or Decimal("0.00"),
            }
            for service in services_qs
        ]
        service_stats = ServiceStatisticsSerializer(
            service_stats_data, many=True
        ).data

        employees_qs = (
            Employee.objects.filter(is_active=True)
            .annotate(
                total_appointments=Count(
                    "appointments",
                    filter=Q(appointments__start__gte=since),
                ),
            )
            .order_by("-total_appointments")
        )

        employee_stats_data = [
            {
                "employee": employee,
                "total_appointments": employee.total_appointments or 0,
                "occupancy_percent": Decimal("0.00"),
            }
            for employee in employees_qs
        ]
        employee_stats = EmployeeStatisticsSerializer(
            employee_stats_data, many=True
        ).data

        data = {
            "period": {
                "days": days,
                "from": since,
                "to": now,
            },
            "summary": {
                "total_clients": total_clients,
                "new_clients": new_clients,
                "total_appointments": total_appointments,
                "completed_appointments": completed_appointments,
                "cancelled_appointments": cancelled_appointments,
                "no_show_appointments": no_show_appointments,
                "total_revenue": total_revenue,
            },
            "services": service_stats,
            "employees": employee_stats,
        }

        return Response(data)

# ==================== DASHBOARD VIEW ====================
class DashboardView(APIView):
    """
    Dashboard dopasowany do roli użytkownika:

    - Manager: podsumowania + dzisiejsze / nadchodzące wizyty
    - Pracownik: dzisiejszy grafik + przyszłe wizyty
    - Klient: nadchodzące wizyty + historia + wydane środki
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        user = request.user
        now = timezone.now()
        today = timezone.localdate()

        if not user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        #używamy is_client, is_employee, is_manager
        if hasattr(user, "is_client") and getattr(user, "is_client", False):
            return self._client_dashboard(user, now, today)

        if hasattr(user, "is_employee") and getattr(user, "is_employee", False):
            return self._employee_dashboard(user, now, today)

        if hasattr(user, "is_manager") and getattr(user, "is_manager", False):
            return self._manager_dashboard(user, now, today)

        return Response(
            {"detail": "Brak przypisanej roli w systemie."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def _client_dashboard(self, user: Any, now: datetime, today: Any) -> Response:
        """Dashboard klienta."""
        try:
            client = user.client_profile
        except Client.DoesNotExist:
            return Response(
                {"detail": "Konto nie jest powiązane z klientem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        upcoming = Appointment.objects.filter(
            client=client,
            start__gte=now,
        ).order_by("start")[:10]

        last_visits = Appointment.objects.filter(
            client=client,
            start__lt=now,
            status__in=[
                Appointment.Status.COMPLETED,
                Appointment.Status.CANCELLED,
                Appointment.Status.NO_SHOW,
            ],
        ).order_by("-start")[:5]

        total_spent = (
                Payment.objects.filter(
                    appointment__client=client,
                    status__in=[Payment.Status.PAID, Payment.Status.DEPOSIT],
                ).aggregate(total=Sum("amount"))["total"]
                or Decimal("0.00")
        )

        data = {
            "role": "client",
            "client": ClientDetailSerializer(client).data,
            "upcoming_appointments": AppointmentListSerializer(
                upcoming, many=True
            ).data,
            "last_visits": AppointmentListSerializer(
                last_visits, many=True
            ).data,
            "total_spent": total_spent,
        }
        return Response(data)

    def _employee_dashboard(self, user: Any, now: datetime, today: Any) -> Response:
        """Dashboard pracownika."""
        try:
            employee = user.employee
        except Employee.DoesNotExist:
            return Response(
                {"detail": "Konto nie jest powiązane z pracownikiem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today_appointments = Appointment.objects.filter(
            employee=employee,
            start__date=today,
        ).order_by("start")

        upcoming = Appointment.objects.filter(
            employee=employee,
            start__gt=now,
        ).order_by("start")[:20]

        pending_time_off = TimeOff.objects.filter(
            employee=employee, status=TimeOff.Status.PENDING
        ).order_by("date_from")

        data = {
            "role": "employee",
            "employee": EmployeeDetailSerializer(employee).data,
            "today_appointments_count": today_appointments.count(),
            "today_appointments": AppointmentListSerializer(
                today_appointments, many=True
            ).data,
            "upcoming_appointments_count": upcoming.count(),
            "upcoming_appointments": AppointmentListSerializer(
                upcoming, many=True
            ).data,
            "pending_time_off_requests": TimeOffSerializer(
                pending_time_off, many=True
            ).data,
        }
        return Response(data)

    def _manager_dashboard(self, user: Any, now: datetime, today: Any) -> Response:
        """Dashboard managera."""
        todays_appointments = Appointment.objects.filter(start__date=today)
        total_today = todays_appointments.count()
        completed_today = todays_appointments.filter(
            status=Appointment.Status.COMPLETED
        ).count()
        cancelled_today = todays_appointments.filter(
            status=Appointment.Status.CANCELLED
        ).count()

        todays_revenue = (
                Payment.objects.filter(
                    created_at__date=today,
                    status__in=[Payment.Status.PAID, Payment.Status.DEPOSIT],
                ).aggregate(total=Sum("amount"))["total"]
                or Decimal("0.00")
        )

        new_clients_today = Client.objects.filter(
            created_at__date=today,
            deleted_at__isnull=True,
        ).count()

        latest_snapshot = StatsSnapshot.objects.order_by("-created_at").first()
        snapshot_data = (
            StatsSnapshotSerializer(latest_snapshot).data
            if latest_snapshot
            else None
        )

        upcoming_appointments = Appointment.objects.filter(
            start__gte=now
        ).order_by("start")[:20]

        data = {
            "role": "manager",
            "today": {
                "date": today,
                "total_appointments": total_today,
                "completed_appointments": completed_today,
                "cancelled_appointments": cancelled_today,
                "new_clients": new_clients_today,
                "revenue": todays_revenue,
            },
            "latest_stats_snapshot": snapshot_data,
            "upcoming_appointments": AppointmentListSerializer(
                upcoming_appointments, many=True
            ).data,
        }
        return Response(data)

# ==================== POPULAR SERVICES VIEW (EXTRA) ====================
class PopularServicesView(APIView):
    """
    Popularne usługi (na podstawie liczby wizyt w ostatnich X dniach).
    Publiczne – można użyć np. na stronie głównej.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        days_param = request.query_params.get("days", "30")
        try:
            days = int(days_param)
        except ValueError:
            days = 30

        now = timezone.now()
        since = now - timedelta(days=days)

        services_qs = (
            Service.objects.filter(is_published=True)
            .annotate(
                appointments_count=Count(
                    "appointments",
                    filter=Q(appointments__start__gte=since),
                )
            )
            .filter(appointments_count__gt=0)
            .order_by("-appointments_count")[:20]
        )
        serializer = ServiceListSerializer(services_qs, many=True)
        return Response(serializer.data)