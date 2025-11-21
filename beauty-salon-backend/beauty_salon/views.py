from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.utils import timezone
from django.utils.dateparse import parse_date

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status, permissions, serializers, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView


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

User = get_user_model()


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
    user,
    type: str,
    message: str,
    entity=None,
    request=None,
    level=AuditLog.Level.INFO,
    metadata=None,
):
    """Prosty helper do tworzenia wpisów w AuditLog."""
    return AuditLog.objects.create(
        type=type,
        level=level,
        user=user if user and user.is_authenticated else None,
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
    ZarzÄ…dzanie uÅ¼ytkownikami systemu.

    - Manager: peÅ‚ny dostÄ™p (lista, tworzenie, edycja, reset hasÅ‚a)
    - KaÅ¼dy zalogowany: endpoint `me` + `change_password`
    """

    queryset = User.objects.all()
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["role", "is_active", "is_staff"]
    ordering_fields = ["created_at", "email", "role"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return UserListSerializer
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ["update", "partial_update"]:
            return UserUpdateSerializer
        return UserDetailSerializer

    def get_permissions(self):
        if self.action in ["me", "change_password"]:
            return [permissions.IsAuthenticated()]
        if self.action == "reset_password":
            return [IsManager()]
        # wszystko inne â€“ tylko manager
        return [IsManager()]

    @action(detail=False, methods=["get"])
    def me(self, request):
        """Zwraca dane zalogowanego uÅ¼ytkownika."""
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        """Reset hasÅ‚a wskazanego uÅ¼ytkownika (tylko manager)."""
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
            message=f"Reset hasÅ‚a dla uÅ¼ytkownika {user.email}",
            entity=user,
            request=request,
        )

        return Response({"detail": "HasÅ‚o zostaÅ‚o zresetowane."})

    @action(detail=False, methods=["post"])
    def change_password(self, request):
        """Zmiana wÅ‚asnego hasÅ‚a."""
        serializer = PasswordChangeSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        new_password = serializer.validated_data["new_password"]
        user = request.user
        user.set_password(new_password)
        user.failed_login_attempts = 0
        user.account_locked_until = None
        user.save(update_fields=["password", "failed_login_attempts", "account_locked_until"])

        create_audit_log(
            user=user,
            type="user.change_password",
            message="UÅ¼ytkownik zmieniÅ‚ wÅ‚asne hasÅ‚o.",
            entity=user,
            request=request,
        )

        return Response({"detail": "HasÅ‚o zostaÅ‚o zmienione."})


# ==================== SERVICE VIEWS ====================


class ServiceViewSet(viewsets.ModelViewSet):
    """
    UsÅ‚ugi salonu.

    - Lista / szczegÃ³Å‚y: dostÄ™pne dla wszystkich (publiczny katalog usÅ‚ug)
    - Tworzenie/edycja/usuwanie: manager lub pracownik
    """

    queryset = Service.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["category", "is_published"]
    search_fields = ["name", "description", "category"]
    ordering_fields = ["category", "name", "price", "created_at", "reservations_count"]
    ordering = ["category", "name"]

    def get_serializer_class(self):
        if self.action == "list":
            return ServiceListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return ServiceCreateUpdateSerializer
        return ServiceDetailSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve", "published"]:
            return [permissions.AllowAny()]
        return [IsManagerOrEmployee()]

    @action(detail=False, methods=["get"])
    def published(self, request):
        """Lista tylko opublikowanych usÅ‚ug."""
        qs = self.filter_queryset(
            self.get_queryset().filter(is_published=True)
        )
        serializer = ServiceListSerializer(qs, many=True)
        return Response(serializer.data)


# ==================== EMPLOYEE VIEWS ====================


class EmployeeViewSet(viewsets.ModelViewSet):
    """
    Pracownicy salonu.

    - Publicznie: lista / szczegÃ³Å‚y (np. do wyboru w rezerwacji)
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

    def get_serializer_class(self):
        if self.action == "list":
            return EmployeeListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return EmployeeCreateUpdateSerializer
        return EmployeeDetailSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsManager()]
        if self.action in ["me", "upcoming_appointments", "services"]:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Lista aktywnych pracownikÃ³w."""
        qs = self.filter_queryset(self.get_queryset().filter(is_active=True))
        serializer = EmployeeListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def me(self, request):
        """Dane pracownika powiÄ…zanego z zalogowanym uÅ¼ytkownikiem."""
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
                {"detail": "Konto nie jest powiÄ…zane z pracownikiem."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = EmployeeDetailSerializer(employee)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def services(self, request, pk=None):
        """UsÅ‚ugi wykonywane przez pracownika."""
        employee = self.get_object()
        serializer = ServiceListSerializer(employee.skills.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def upcoming_appointments(self, request, pk=None):
        """NajbliÅ¼sze wizyty danego pracownika."""
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

    - Manager/pracownik: peÅ‚ne zarzÄ…dzanie klientami
    - Klient: dostÄ™p do wÅ‚asnego profilu przez `me` oraz `my_appointments`
    """

    queryset = Client.objects.select_related("user").all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["marketing_consent", "preferred_contact", "deleted_at"]
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

    def get_serializer_class(self):
        if self.action == "list":
            return ClientListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return ClientCreateUpdateSerializer
        if self.action == "soft_delete":
            return ClientSoftDeleteSerializer
        return ClientDetailSerializer

    def get_permissions(self):
        if self.action in ["me", "my_appointments"]:
            return [permissions.IsAuthenticated()]
        if self.action == "soft_delete":
            return [IsManagerOrEmployee()]
        # default: manager + pracownik
        return [IsManagerOrEmployee()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Manager/pracownik â€“ wszyscy klienci
        if (
            user.is_authenticated
            and (
                (hasattr(user, "is_manager") and user.is_manager())
                or (
                    hasattr(user, "is_salon_employee")
                    and user.is_salon_employee()
                )
            )
        ):
            return qs

        # Klient â€“ tylko wÅ‚asny rekord
        if (
            user.is_authenticated
            and hasattr(user, "is_salon_client")
            and user.is_salon_client()
        ):
            return qs.filter(user=user)

        # Inni â€“ nic
        return qs.none()

    @action(detail=False, methods=["get"])
    def me(self, request):
        """Profil klienta powiÄ…zanego z zalogowanym uÅ¼ytkownikiem."""
        user = request.user
        if not user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            client = user.client
        except Client.DoesNotExist:
            return Response(
                {"detail": "Konto nie jest powiÄ…zane z klientem."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ClientDetailSerializer(client)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def soft_deleted(self, request):
        """Lista miÄ™kko usuniÄ™tych klientÃ³w (tylko personel)."""
        qs = Client.objects.filter(deleted_at__isnull=False)
        serializer = ClientListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def soft_delete(self, request):
        """MiÄ™kkie usuniÄ™cie klienta (tylko personel)."""
        serializer = ClientSoftDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        client = serializer.save()

        create_audit_log(
            user=request.user,
            type="client.soft_delete",
            message=f"MiÄ™kko usuniÄ™to klienta {client.get_full_name()}",
            entity=client,
            request=request,
        )

        return Response(
            {"detail": "Klient zostaÅ‚ oznaczony jako usuniÄ™ty."},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"])
    def appointments(self, request, pk=None):
        """Lista wizyt konkretnego klienta."""
        client = self.get_object()
        qs = Appointment.objects.filter(client=client).order_by("-start")
        serializer = AppointmentListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def my_appointments(self, request):
        """Wizyty zalogowanego klienta."""
        user = request.user
        if not user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            client = user.client
        except Client.DoesNotExist:
            return Response(
                {"detail": "Konto nie jest powiÄ…zane z klientem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = Appointment.objects.filter(client=client).order_by("-start")
        serializer = AppointmentListSerializer(qs, many=True)
        return Response(serializer.data)


# ==================== SCHEDULE VIEWS ====================


class ScheduleViewSet(viewsets.ModelViewSet):
    """
    Grafiki pracy pracownikÃ³w.

    - Manager/pracownik: peÅ‚ny dostÄ™p
    """

    queryset = Schedule.objects.select_related("employee").all()
    serializer_class = ScheduleSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["employee", "status"]
    ordering_fields = ["created_at", "updated_at"]
    ordering = ["-created_at"]

    def get_permissions(self):
        return [IsManagerOrEmployee()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if (
            user.is_authenticated
            and hasattr(user, "is_manager")
            and user.is_manager()
        ):
            return qs

        if (
            user.is_authenticated
            and hasattr(user, "is_salon_employee")
            and user.is_salon_employee()
        ):
            return qs.filter(employee__user=user)

        return qs.none()

    @action(detail=False, methods=["get"])
    def my_schedule(self, request):
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
                {"detail": "Konto nie jest powiÄ…zane z pracownikiem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = Schedule.objects.filter(employee=employee)
        serializer = ScheduleSerializer(qs, many=True)
        return Response(serializer.data)


# ==================== TIME OFF VIEWS ====================


class TimeOffViewSet(viewsets.ModelViewSet):
    """
    Urlopy / nieobecnoÅ›ci pracownikÃ³w.

    - Manager/pracownik: przeglÄ…d
    - Zatwierdzanie: tylko manager
    """

    queryset = TimeOff.objects.select_related("employee", "approved_by").all()
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["employee", "status", "type", "date_from", "date_to"]
    ordering_fields = ["date_from", "created_at"]
    ordering = ["-date_from"]

    def get_serializer_class(self):
        if self.action == "approve":
            return TimeOffApproveSerializer
        return TimeOffSerializer

    def get_permissions(self):
        if self.action == "approve":
            return [IsManager()]
        return [IsManagerOrEmployee()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if (
            user.is_authenticated
            and hasattr(user, "is_manager")
            and user.is_manager()
        ):
            return qs

        if (
            user.is_authenticated
            and hasattr(user, "is_salon_employee")
            and user.is_salon_employee()
        ):
            return qs.filter(employee__user=user)

        return qs.none()

    @action(detail=False, methods=["get"])
    def my_time_off(self, request):
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
                {"detail": "Konto nie jest powiÄ…zane z pracownikiem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = TimeOff.objects.filter(employee=employee)
        serializer = TimeOffSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def approve(self, request):
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
    - Klient: tylko wÅ‚asne wizyty (przez list / retrieve)
    """

    queryset = (
        Appointment.objects.select_related("client", "employee", "service")
        .all()
    )
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status", "employee", "client", "service"]
    ordering_fields = ["start", "created_at"]
    ordering = ["-start"]

    def get_serializer_class(self):
        if self.action == "list":
            return AppointmentListSerializer
        if self.action == "create":
            return AppointmentCreateSerializer
        if self.action in ["update", "partial_update"]:
            return AppointmentCreateSerializer
        if self.action == "change_status":
            return AppointmentStatusUpdateSerializer
        return AppointmentDetailSerializer

    def get_permissions(self):
        if self.action in ["change_status", "destroy"]:
            return [IsManagerOrEmployee()]
        if self.action in ["create", "update", "partial_update"]:
            return [IsManagerOrEmployee()]
        if self.action in ["my_appointments", "today", "upcoming"]:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
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

        # Manager/pracownik â€“ wszystkie wizyty
        if (
            hasattr(user, "is_manager")
            and user.is_manager()
        ) or (
            hasattr(user, "is_salon_employee")
            and user.is_salon_employee()
        ):
            return qs

        # Klient â€“ tylko wÅ‚asne
        if hasattr(user, "is_salon_client") and user.is_salon_client():
            try:
                client = user.client
            except Client.DoesNotExist:
                return qs.none()
            return qs.filter(client=client)

        return qs.none()

    @action(detail=False, methods=["get"])
    def today(self, request):
        """Wizyty dzisiaj (filtrowane po roli uÅ¼ytkownika)."""
        today = timezone.localdate()
        qs = self.get_queryset().filter(start__date=today).order_by("start")
        serializer = AppointmentListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        """PrzyszÅ‚e wizyty (domyÅ›lnie od teraz)."""
        now = timezone.now()
        qs = self.get_queryset().filter(start__gte=now).order_by("start")
        serializer = AppointmentListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def my_appointments(self, request):
        """Wizyty zalogowanego uÅ¼ytkownika (klient/pracownik)."""
        user = request.user
        if hasattr(user, "is_salon_client") and user.is_salon_client():
            try:
                client = user.client
            except Client.DoesNotExist:
                return Response(
                    {"detail": "Konto nie jest powiÄ…zane z klientem."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            qs = Appointment.objects.filter(client=client).order_by("-start")
        elif hasattr(user, "is_salon_employee") and user.is_salon_employee():
            try:
                employee = user.employee
            except Employee.DoesNotExist:
                return Response(
                    {"detail": "Konto nie jest powiÄ…zane z pracownikiem."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            qs = Appointment.objects.filter(employee=employee).order_by("-start")
        else:
            qs = Appointment.objects.none()

        serializer = AppointmentListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def change_status(self, request, pk=None):
        """
        Zmiana statusu wizyty (np. anulowanie, no-show).
        """
        appointment = self.get_object()
        serializer = AppointmentStatusUpdateSerializer(
            appointment, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        appointment = serializer.save()

        create_audit_log(
            user=request.user,
            type="appointment.change_status",
            message=f"Zmiana statusu wizyty ID={appointment.id} na {appointment.status}",
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

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsManagerOrEmployee()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return qs.none()

        # Manager/pracownik â€“ wszystkie notatki
        if (
            hasattr(user, "is_manager")
            and user.is_manager()
        ) or (
            hasattr(user, "is_salon_employee")
            and user.is_salon_employee()
        ):
            return qs

        # Klient â€“ tylko notatki widoczne przy jego wizytach
        if hasattr(user, "is_salon_client") and user.is_salon_client():
            try:
                client = user.client
            except Client.DoesNotExist:
                return qs.none()
            return qs.filter(
                appointment__client=client,
                visible_for_client=True,
            )

        return qs.none()

    @action(detail=False, methods=["get"])
    def my_notes(self, request):
        """Notatki stworzone przez zalogowanego uÅ¼ytkownika (dla personelu)."""
        user = request.user
        if not user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        qs = Note.objects.filter(author=user).order_by("-created_at")
        serializer = NoteSerializer(qs, many=True)
        return Response(serializer.data)


class MediaAssetViewSet(viewsets.ModelViewSet):
    """
    MateriaÅ‚y (portfolio, zdjÄ™cia efektÃ³w itd.).

    - PodglÄ…d: dla wszystkich
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

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsManagerOrEmployee()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        """
        JeÅ›li dodaje pracownik â€“ automatycznie przypisujemy jego profil Employee.
        Manager moÅ¼e wskazaÄ‡ dowolnego pracownika.
        """
        user = self.request.user
        if (
            hasattr(user, "is_salon_employee")
            and user.is_salon_employee()
            and not (hasattr(user, "is_manager") and user.is_manager())
        ):
            # pracownik â€“ przypinamy jego profil
            try:
                employee = user.employee
            except Employee.DoesNotExist:
                raise serializers.ValidationError(
                    "Konto nie jest powiÄ…zane z pracownikiem."
                )
            serializer.save(employee=employee)
        else:
            serializer.save()


# ==================== PAYMENT & INVOICE VIEWS ====================


class PaymentViewSet(viewsets.ModelViewSet):
    """
    PÅ‚atnoÅ›ci za wizyty.

    - Personel: widzi wszystkie pÅ‚atnoÅ›ci, moÅ¼e je tworzyÄ‡ i oznaczaÄ‡ jako zapÅ‚acone
    - Klient: widzi tylko swoje pÅ‚atnoÅ›ci
    """

    queryset = Payment.objects.select_related(
        "appointment", "appointment__client"
    ).all()
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status", "method", "type", "appointment", "appointment__client"]
    ordering_fields = ["created_at", "paid_at", "amount"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return PaymentCreateSerializer
        if self.action == "mark_as_paid":
            return PaymentMarkAsPaidSerializer
        return PaymentSerializer

    def get_permissions(self):
        if self.action in ["create", "mark_as_paid", "update", "partial_update", "destroy"]:
            return [IsManagerOrEmployee()]
        if self.action in ["list", "retrieve", "my_payments"]:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return qs.none()

        # Personel â€“ wszystkie
        if (
            hasattr(user, "is_manager")
            and user.is_manager()
        ) or (
            hasattr(user, "is_salon_employee")
            and user.is_salon_employee()
        ):
            return qs

        # Klient â€“ tylko wÅ‚asne
        if hasattr(user, "is_salon_client") and user.is_salon_client():
            try:
                client = user.client
            except Client.DoesNotExist:
                return qs.none()
            return qs.filter(appointment__client=client)

        return qs.none()

    @action(detail=False, methods=["get"])
    def my_payments(self, request):
        """PÅ‚atnoÅ›ci zalogowanego klienta."""
        qs = self.get_queryset()
        serializer = PaymentSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def mark_as_paid(self, request):
        """
        Oznacz wybranÄ… pÅ‚atnoÅ›Ä‡ jako zapÅ‚aconÄ….
        """
        serializer = PaymentMarkAsPaidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()

        create_audit_log(
            user=request.user,
            type="payment.mark_as_paid",
            message=f"PÅ‚atnoÅ›Ä‡ ID={payment.id} oznaczona jako zapÅ‚acona.",
            entity=payment,
            request=request,
        )

        return Response(
            {
                "detail": "PÅ‚atnoÅ›Ä‡ oznaczona jako zapÅ‚acona.",
                "payment": PaymentSerializer(payment).data,
            }
        )


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Faktury.

    - Personel: widzi wszystkie
    - Klient: widzi tylko wÅ‚asne faktury
    """

    queryset = Invoice.objects.select_related("client", "appointment").all()
    serializer_class = InvoiceSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["client", "is_paid", "issue_date", "due_date"]
    ordering_fields = ["issue_date", "due_date", "gross_amount", "created_at"]
    ordering = ["-issue_date"]

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return qs.none()

        # Personel â€“ wszystkie faktury
        if (
            hasattr(user, "is_manager")
            and user.is_manager()
        ) or (
            hasattr(user, "is_salon_employee")
            and user.is_salon_employee()
        ):
            return qs

        # Klient â€“ tylko wÅ‚asne
        if hasattr(user, "is_salon_client") and user.is_salon_client():
            try:
                client = user.client
            except Client.DoesNotExist:
                return qs.none()
            return qs.filter(client=client)

        return qs.none()

    @action(detail=False, methods=["get"])
    def my_invoices(self, request):
        """Faktury zalogowanego klienta."""
        qs = self.get_queryset()
        serializer = InvoiceSerializer(qs, many=True)
        return Response(serializer.data)


# ==================== NOTIFICATION & REPORT VIEWS ====================


class NotificationViewSet(viewsets.ModelViewSet):
    """
    Powiadomienia (np. przypomnienia o wizycie).

    - Personel: zarzÄ…dza powiadomieniami
    - Klient: widzi tylko swoje powiadomienia
    """

    queryset = Notification.objects.select_related(
        "client", "appointment"
    ).all()
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["client", "type", "channel", "status"]
    ordering_fields = ["scheduled_at", "created_at"]
    ordering = ["-scheduled_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return NotificationCreateSerializer
        return NotificationSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsManagerOrEmployee()]
        if self.action in ["list", "retrieve", "my_notifications"]:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return qs.none()

        # Personel â€“ wszystkie powiadomienia
        if (
            hasattr(user, "is_manager")
            and user.is_manager()
        ) or (
            hasattr(user, "is_salon_employee")
            and user.is_salon_employee()
        ):
            return qs

        # Klient â€“ tylko wÅ‚asne
        if hasattr(user, "is_salon_client") and user.is_salon_client():
            try:
                client = user.client
            except Client.DoesNotExist:
                return qs.none()
            return qs.filter(client=client)

        return qs.none()

    @action(detail=False, methods=["get"])
    def my_notifications(self, request):
        """Powiadomienia zalogowanego klienta."""
        qs = self.get_queryset()
        serializer = NotificationSerializer(qs, many=True)
        return Response(serializer.data)


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


# ==================== AUDIT LOG & SYSTEM SETTINGS ====================


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Logi audytowe systemu (tylko manager).
    """

    queryset = AuditLog.objects.select_related("user").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsManager]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["type", "level", "user", "timestamp"]
    ordering_fields = ["timestamp"]
    ordering = ["-timestamp"]


class SystemSettingsView(APIView):
    """
    Ustawienia systemowe.

    - GET: kaÅ¼dy zalogowany
    - PATCH: tylko manager
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Pobierz aktualne ustawienia systemowe."""
        settings = SystemSettings.load()
        serializer = SystemSettingsSerializer(settings)
        return Response(serializer.data)

    def patch(self, request):
        """Aktualizacja ustawieÅ„ (tylko manager)."""
        user = request.user
        if not (hasattr(user, "is_manager") and user.is_manager()):
            return Response(
                {"detail": "Tylko manager moÅ¼e aktualizowaÄ‡ ustawienia systemowe."},
                status=status.HTTP_403_FORBIDDEN,
            )

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
            message="Aktualizacja ustawieÅ„ systemowych.",
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


# ==================== STATISTICS VIEW ====================


class StatisticsView(APIView):
    """
    Globalne statystyki salonu (wizyty, przychody, usÅ‚ugi, pracownicy).

    DomyÅ›lny okres: ostatnie 30 dni (parametr ?days=).
    """

    permission_classes = [IsManagerOrEmployee]

    def get(self, request):
        days = request.query_params.get("days", "30")
        try:
            days = int(days)
        except ValueError:
            days = 30

        now = timezone.now()
        since = now - timedelta(days=days)

        # Podstawowe statystyki
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

        # Statystyki usÅ‚ug
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

        # Statystyki pracownikÃ³w
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
                # Proste pole â€“ dokÅ‚adne wyliczanie obÅ‚oÅ¼enia wymagaÅ‚oby slotÃ³w czasowych
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
    Dashboard dopasowany do roli uÅ¼ytkownika:

    - Manager: podsumowania + dzisiejsze / nadchodzÄ…ce wizyty
    - Pracownik: dzisiejszy grafik + przyszÅ‚e wizyty
    - Klient: nadchodzÄ…ce wizyty + historia + wydane Å›rodki
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        today = timezone.localdate()

        # Klient
        if hasattr(user, "is_salon_client") and user.is_salon_client():
            return self._client_dashboard(user, now, today)

        # Pracownik
        if hasattr(user, "is_salon_employee") and user.is_salon_employee():
            return self._employee_dashboard(user, now, today)

        # Manager
        if hasattr(user, "is_manager") and user.is_manager():
            return self._manager_dashboard(user, now, today)

        # Fallback
        return Response(
            {"detail": "Brak przypisanej roli w systemie."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def _client_dashboard(self, user, now, today):
        """
        Dashboard klienta â€“ uÅ¼ywamy user.client (OneToOneField),
        jak pisaÅ‚eÅ› â€“ to jest prawidÅ‚owe podejÅ›cie.
        """
        try:
            client = user.client
        except Client.DoesNotExist:
            return Response(
                {"detail": "Konto nie jest powiÄ…zane z klientem."},
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

    def _employee_dashboard(self, user, now, today):
        """
        Dashboard pracownika â€“ rÃ³wnieÅ¼ korzysta z user.employee (OneToOneField).
        """
        try:
            employee = user.employee
        except Employee.DoesNotExist:
            return Response(
                {"detail": "Konto nie jest powiÄ…zane z pracownikiem."},
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

    def _manager_dashboard(self, user, now, today):
        # Podstawowe dzienne statystyki
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
    Popularne usÅ‚ugi (na podstawie liczby wizyt w ostatnich X dniach).
    Publiczne â€“ moÅ¼na uÅ¼yÄ‡ np. na stronie gÅ‚Ã³wnej.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        days = int(request.query_params.get("days", 30))
        since = timezone.now() - timedelta(days=days)

        qs = (
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
        serializer = ServiceListSerializer(qs, many=True)
        return Response(serializer.data)