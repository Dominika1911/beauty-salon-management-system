from decimal import Decimal
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, cast
from django.db import transaction
from django.db.utils import IntegrityError
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractBaseUser
from rest_framework import serializers
from django.core.validators import RegexValidator


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

User = get_user_model()


# ==================== MIXINS & UTILITIES ====================


class ServicePriceMixin(serializers.Serializer):
    """
    Mixin do wyliczania ceny z promocją,
    korzysta z metody modelu: Service.get_price_with_promotion().
    """
    price_with_promotion = serializers.DecimalField(
        source="get_price_with_promotion",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )


# ==================== USER SERIALIZERS ====================


class UserListSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    account_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "role",
            "role_display",
            "is_active",
            "is_staff",
            "account_status",
            "created_at",
        ]
        read_only_fields = ["id", "account_status", "created_at"]

    def get_account_status(self, obj: AbstractBaseUser) -> str:
        locked_until = getattr(obj, "account_locked_until", None)
        if locked_until and locked_until > timezone.now():
            return "locked"
        if getattr(obj, "failed_login_attempts", 0) >= 3:
            return "warning"
        if obj.is_active:
            return "active"
        return "inactive"


class UserDetailSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    employee_id = serializers.IntegerField(source="employee.id", read_only=True)
    client_id = serializers.IntegerField(source="client.id", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "role",
            "role_display",
            "is_active",
            "is_staff",
            "last_login",
            "last_login_ip",
            "failed_login_attempts",
            "account_locked_until",
            "employee_id",
            "client_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "email",
            "employee_id",
            "client_id",
            "failed_login_attempts",
            "account_locked_until",
            "created_at",
            "updated_at",
        ]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = ["id", "email", "password", "role", "is_active", "is_staff"]
        read_only_fields = ["id"]

    def create(self, validated_data: dict[str, Any]) -> AbstractBaseUser:

        password = validated_data.pop("password", None)
        email = validated_data.pop("email")

        if not password:
            # Jeżeli hasło nie podane – generujemy losowe (np. do wysłania mailem)
            password = secrets.token_urlsafe(8)

        user = User.objects.create_user(email=email, password=password, **validated_data)

        # Dla managera i pracownika domyślnie ustawiamy is_staff
        if user.role in [User.RoleChoices.MANAGER, User.RoleChoices.EMPLOYEE] and not user.is_staff:
            user.is_staff = True
            user.save(update_fields=["is_staff"])

        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["role", "is_active", "is_staff"]


class PasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value: str) -> str:
        if len(value) < 8:
            raise serializers.ValidationError("Hasło musi mieć co najmniej 8 znaków.")
        return value


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value: str) -> str:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Brak uwierzytelnionego użytkownika.")
        if not user.check_password(value):
            raise serializers.ValidationError("Niepoprawne stare hasło.")
        return value

    def validate_new_password(self, value: str) -> str:
        if len(value) < 8:
            raise serializers.ValidationError("Hasło musi mieć co najmniej 8 znaków.")
        return value

    def save(self, **kwargs: Any) -> AbstractBaseUser:
        user = cast(AbstractBaseUser, self.context["request"].user)
        user.set_password(self.validated_data["new_password"])
        # Poniższe pola są z customowego Usera – mypy ich nie zna, więc ignorujemy
        user.failed_login_attempts = 0  # type: ignore[attr-defined]
        user.account_locked_until = None  # type: ignore[attr-defined]
        user.save(update_fields=["password", "failed_login_attempts", "account_locked_until"])
        return user


# ==================== SERVICE SERIALIZERS ====================


class ServiceListSerializer(ServicePriceMixin, serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = [
            "id",
            "name",
            "category",
            "price",
            "duration",
            "image_url",
            "is_published",
            "promotion",
            "reservations_count",
            "price_with_promotion",
            "created_at",
        ]
        read_only_fields = ["id", "reservations_count", "price_with_promotion", "created_at"]


class ServiceDetailSerializer(ServicePriceMixin, serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = [
            "id",
            "name",
            "category",
            "description",
            "price",
            "duration",
            "image_url",
            "is_published",
            "promotion",
            "reservations_count",
            "price_with_promotion",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "reservations_count",
            "price_with_promotion",
            "created_at",
            "updated_at",
        ]


class ServiceCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = [
            "name",
            "category",
            "description",
            "price",
            "duration",
            "image_url",
            "is_published",
            "promotion",
        ]

    def validate_price(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Cena musi być większa od zera.")
        return value

    def validate_duration(self, value: timedelta) -> timedelta:
        if value.total_seconds() <= 0:
            raise serializers.ValidationError("Czas trwania musi być dodatni.")
        return value

# ==================== EMPLOYEE SERIALIZERS ====================

class EmployeeSimpleSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="pk", read_only=True)
    full_name = serializers.CharField(source="get_full_name", read_only=True)

    class Meta:
        model = Employee
        fields = ["id", "number", "full_name"]
        read_only_fields = ["id", "number", "full_name"]


class EmployeeListSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="pk", read_only=True)
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    skills = ServiceListSerializer(many=True, read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "number",
            "first_name",
            "last_name",
            "full_name",
            "user_email",
            "phone",
            "hired_at",
            "average_rating",
            "is_active",
            "appointments_count",
            "skills",
            "created_at",
        ]
        read_only_fields = ["id", "number", "appointments_count", "created_at"]


class EmployeeDetailSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="pk", read_only=True)
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    skills = ServiceListSerializer(many=True, read_only=True)
    skill_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Service.objects.all(),
        source="skills",
        write_only=True,
        required=False,
    )
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "number",
            "first_name",
            "last_name",
            "full_name",
            "user_email",
            "phone",
            "hired_at",
            "average_rating",
            "is_active",
            "appointments_count",
            "skills",
            "skill_ids",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "number",
            "appointments_count",
            "skills",
            "created_at",
            "updated_at",
        ]

# ==================== EMPLOYEE SERIALIZERS ====================
class EmployeeCreateUpdateSerializer(serializers.ModelSerializer):
    # dane konta użytkownika
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        required=True,
    )

    # lista ID usług, mapowana na relację ManyToMany `skills`
    skill_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Service.objects.all(),
        source="skills",   # w validated_data będzie klucz "skills" z obiektami Service
        write_only=True,
        required=False,
    )

    class Meta:
        model = Employee
        fields = [
            "id",
            "number",
            "first_name",
            "last_name",
            "phone",
            "hired_at",
            "is_active",
            "appointments_count",
            "average_rating",
            "skills",       # tylko do odczytu
            "skill_ids",    # do zapisu (lista ID)
            "email",
            "password",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "number",
            "appointments_count",
            "average_rating",
            "skills",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data: Dict[str, Any]) -> Employee:
        email: str = validated_data.pop("email")
        password: str = validated_data.pop("password")

        # dzięki source="skills" mamy tu już listę obiektów Service
        skills_raw = validated_data.pop("skills", [])
        skills: list[Service] = cast(list[Service], skills_raw)

        # sprawdzamy, czy mail nie jest już zajęty przez innego usera
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError(
                {"email": "Użytkownik z takim adresem e-mail już istnieje."}
            )

        with transaction.atomic():
            # tworzymy użytkownika (albo bierzemy istniejącego, gdyby w przyszłości było get_or_create)
            user = User.objects.create_user(
                email=email,
                password=password,
                role=User.RoleChoices.EMPLOYEE,
                is_staff=True,
            )

            # jeśli Employee dla tego usera już istnieje (np. utworzony w sygnale) – tylko go uzupełniamy
            employee, created = Employee.objects.get_or_create(
                user=user,
                defaults=validated_data,
            )

            if not created:
                # aktualizacja pól pracownika, jeśli rekord już był
                for attr, value in validated_data.items():
                    setattr(employee, attr, value)
                employee.save()

            if skills:
                employee.skills.set(skills)

        return employee

    def update(self, instance: Employee, validated_data: dict[str, Any]) -> Employee:
        email: Optional[str] = validated_data.pop("email", None)
        password: Optional[str] = validated_data.pop("password", None)

        skills_raw = validated_data.pop("skills", None)
        skills: Optional[list[Service]] = (
            cast(list[Service], skills_raw) if skills_raw is not None else None
        )

        user = instance.user

        # aktualizacja e-maila
        if email is not None and email != user.email:
            if User.objects.exclude(pk=user.pk).filter(email=email).exists():
                raise serializers.ValidationError(
                    {"email": "Użytkownik z takim adresem e-mail już istnieje."}
                )
            user.email = email

        # aktualizacja hasła
        if password:
            user.set_password(password)

        if email is not None or password:
            user.save()

        # pozostałe pola pracownika
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # usługi
        if skills is not None:
            instance.skills.set(skills)

        return instance


# ==================== CLIENT SERIALIZERS ====================


class ClientListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    is_deleted = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            "id",
            "number",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone",
            "user",
            "user_email",
            "marketing_consent",
            "preferred_contact",
            "visits_count",
            "total_spent_amount",
            "deleted_at",
            "is_deleted",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "number",
            "visits_count",
            "total_spent_amount",
            "deleted_at",
            "is_deleted",
            "created_at",
        ]

    def get_is_deleted(self, obj: Client) -> bool:
        return getattr(obj, "deleted_at", None) is not None


class ClientDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    is_deleted = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            "id",
            "number",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone",
            "user",
            "user_email",
            "marketing_consent",
            "preferred_contact",
            "visits_count",
            "total_spent_amount",
            "internal_notes",
            "deleted_at",
            "is_deleted",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "number",
            "visits_count",
            "total_spent_amount",
            "deleted_at",
            "is_deleted",
            "created_at",
            "updated_at",
        ]

    def get_is_deleted(self, obj: Client) -> bool:
        return getattr(obj, "deleted_at", None) is not None


class ClientCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            "number",
            "first_name",
            "last_name",
            "email",
            "phone",
            "user",
            "marketing_consent",
            "preferred_contact",
            "internal_notes",
        ]
        read_only_fields = ["number"]

    def validate_user(self, value: AbstractBaseUser | None) -> AbstractBaseUser | None:
        if value:
            is_client = getattr(value, "is_salon_client", None)
            if not callable(is_client) or not is_client():
                raise serializers.ValidationError("Wybrane konto nie ma roli klienta.")
        return value


class ClientSoftDeleteSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.filter(deleted_at__isnull=True)
    )

    def save(self, **kwargs: Any) -> Client:
        client = cast(Client, self.validated_data["client"])
        client.soft_delete()
        return client

# ============================================================================
# NOWY: Serializer dla pojedynczego obiektu JSON w availability_periods
# ============================================================================

class AvailabilityPeriodSerializer(serializers.Serializer):
    """
    Serializator do walidacji formatu obiektów JSON
    (Używamy CharField, aby unikać TypeError przy odczycie/serializacji odpowiedzi)
    """
    time_regex = RegexValidator(
        regex=r'^\d{2}:\d{2}(:\d{2})?$',  # HH:MM lub HH:MM:SS
        message="Czas musi być w formacie HH:MM lub HH:MM:SS."
    )

    weekday = serializers.CharField(max_length=20)

    # Użycie CharField z walidatorem Regex to najbezpieczniejsza opcja dla JSONField
    start_time = serializers.CharField(
        max_length=8,
        validators=[time_regex],
        error_messages={'invalid': 'Wymagany format czasu to HH:MM:SS.'}
    )
    end_time = serializers.CharField(
        max_length=8,
        validators=[time_regex],
        error_messages={'invalid': 'Wymagany format czasu to HH:MM:SS.'}
    )

    def to_representation(self, instance: Any) -> dict[str, str]:
        """Bezpieczna serializacja danych z JSONField.

        DRF przy serializacji dictów robi lookup po kluczach i rzuca KeyError, jeśli brakuje np. `weekday`.
        W bazie mogą istnieć starsze wpisy zapisane z inną nazwą klucza (np. `day`, `week_day`, `day_of_week`).
        """
        if isinstance(instance, dict):
            weekday_val = (
                instance.get("weekday")
                or instance.get("day")
                or instance.get("week_day")
                or instance.get("day_of_week")
                or instance.get("weekday_display")
                or ""
            )
            start_val = instance.get("start_time") or ""
            end_val = instance.get("end_time") or ""
            return {
                "weekday": str(weekday_val),
                "start_time": str(start_val),
                "end_time": str(end_val),
            }
        return super().to_representation(instance)



    def validate(self, data: dict) -> dict:
        """Dodatkowa walidacja czasu."""
        # Walidacja, czy czas startu nie jest po czasie końca
        if data['start_time'] >= data['end_time']:
            raise serializers.ValidationError("Czas rozpoczęcia musi być wcześniejszy niż czas zakończenia.")
        return data

# ==================== SCHEDULE & TIME OFF SERIALIZERS ====================


class ScheduleSerializer(serializers.ModelSerializer):
    employee_full_name = serializers.CharField(
        source="employee.get_full_name", read_only=True
    )

    availability_periods = AvailabilityPeriodSerializer(many=True, read_only=True)

    class Meta:
        model = Schedule
        fields = [
            "id",
            "employee",
            "employee_full_name",
            "availability_periods",
            "breaks",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class TimeOffSerializer(serializers.ModelSerializer):
    employee_full_name = serializers.CharField(
        source="employee.get_full_name", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    days = serializers.SerializerMethodField()

    class Meta:
        model = TimeOff
        fields = [
            "id",
            "employee",
            "employee_full_name",
            "date_from",
            "date_to",
            "status",
            "status_display",
            "reason",
            "type",
            "type_display",
            "approved_by",
            "approved_at",
            "days",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "approved_by",
            "approved_at",
            "days",
            "created_at",
            "updated_at",
        ]

    def get_days(self, obj: TimeOff) -> int | None:
        if obj.date_from and obj.date_to:
            return (obj.date_to - obj.date_from).days + 1
        return None


class TimeOffApproveSerializer(serializers.Serializer):
    time_off = serializers.PrimaryKeyRelatedField(
        queryset=TimeOff.objects.filter(status=TimeOff.Status.PENDING)
    )

    def save(self, **kwargs: Any) -> TimeOff:
        time_off = cast(TimeOff, self.validated_data["time_off"])
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if time_off.status != TimeOff.Status.PENDING:
            raise serializers.ValidationError(
                "Ten wniosek urlopowy został już rozpatrzony."
            )

        time_off.status = TimeOff.Status.APPROVED
        time_off.approved_by = user if user and getattr(user, "is_authenticated", False) else None
        time_off.approved_at = timezone.now()
        time_off.save()
        return time_off


# ==================== APPOINTMENT SERIALIZERS ====================


class AppointmentListSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.get_full_name", read_only=True)
    employee_name = serializers.CharField(
        source="employee.get_full_name", read_only=True
    )
    service_name = serializers.CharField(source="service.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id",
            "client",
            "client_name",
            "employee",
            "employee_name",
            "service",
            "service_name",
            "status",
            "status_display",
            "start",
            "end",
            "timespan",
            "booking_channel",
            "client_notes",
            "internal_notes",
            "reminder_sent",
            "reminder_sent_at",
        ]
        read_only_fields = ["id", "timespan"]


class AppointmentDetailSerializer(serializers.ModelSerializer):
    client = ClientListSerializer(read_only=True)
    employee = EmployeeSimpleSerializer(read_only=True)
    service = ServiceDetailSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    cancelled_by_email = serializers.EmailField(
        source="cancelled_by.email", read_only=True
    )

    class Meta:
        model = Appointment
        fields = [
            "id",
            "client",
            "employee",
            "service",
            "status",
            "status_display",
            "start",
            "end",
            "timespan",
            "booking_channel",
            "client_notes",
            "internal_notes",
            "cancelled_by",
            "cancelled_by_email",
            "cancelled_at",
            "cancellation_reason",
            "reminder_sent",
            "reminder_sent_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "timespan",
            "cancelled_by",
            "cancelled_by_email",
            "cancelled_at",
            "created_at",
            "updated_at",
        ]


class AppointmentCreateSerializer(serializers.ModelSerializer):
    """
    SlugRelatedField dla stabilnych kluczy biznesowych.

    Zamiast ID (które się zmienia po reset DB), używamy:
    - client: "CLI-0001" (number)
    - employee: "EMP-0001" (number)
    - service: "Strzyżenie damskie" (name)
    """

    client = serializers.SlugRelatedField(
        slug_field='number',  # CLI-0001, CLI-0002...
        queryset=Client.objects.filter(deleted_at__isnull=True),
        error_messages={
            'does_not_exist': 'Klient o podanym numerze nie istnieje.',
            'required': 'Pole "client" jest wymagane.'
        }
    )

    employee = serializers.SlugRelatedField(
        slug_field='number',  # EMP-0001, EMP-0002...
        queryset=Employee.objects.filter(is_active=True),
        error_messages={
            'does_not_exist': 'Pracownik o podanym numerze nie istnieje.',
            'required': 'Pole "employee" jest wymagane.'
        }
    )

    service = serializers.SlugRelatedField(
        slug_field='name',  # "Strzyżenie damskie", "Manicure"...
        queryset=Service.objects.filter(is_published=True),
        error_messages={
            'does_not_exist': 'Usługa o podanej nazwie nie istnieje.',
            'required': 'Pole "service" jest wymagane.'
        }
    )

    class Meta:
        model = Appointment
        fields = [
            "client",
            "employee",
            "service",
            "start",
            "end",
            "booking_channel",
            "client_notes",
            "internal_notes",
        ]
        extra_kwargs = {"end": {"required": False, "allow_null": True}}

    def validate_start(self, value: datetime) -> datetime:
        if value < timezone.now():
            raise serializers.ValidationError(
                "Nie można umawiać wizyt w przeszłości."
            )
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        client = attrs.get("client")
        employee = attrs.get("employee")
        service = attrs.get("service")
        start = attrs.get("start")
        end = attrs.get("end")

        if not start:
            raise serializers.ValidationError({"start": 'Pole "start" jest wymagane.'})

        if client and getattr(client, "deleted_at", None):
            raise serializers.ValidationError(
                {"client": "Klient jest oznaczony jako usunięty (GDPR)."}
            )

        if service and not service.is_published:
            raise serializers.ValidationError(
                {"service": "Usługa nie jest aktualnie publikowana."}
            )

        if employee and not employee.is_active:
            raise serializers.ValidationError(
                {"employee": "Pracownik jest nieaktywny."}
            )

        if employee and service and not employee.skills.filter(pk=service.pk).exists():
            raise serializers.ValidationError(
                {"employee": "Pracownik nie ma przypisanej tej usługi."}
            )

        # domyślny czas trwania z usługi
        if not end and service:
            end = start + service.duration
            attrs["end"] = end

        if end and end <= start:
            raise serializers.ValidationError(
                {"end": "Czas zakończenia musi być późniejszy niż czas rozpoczęcia."}
            )

        active_statuses = [
            Appointment.Status.PENDING,
            Appointment.Status.CONFIRMED,
            Appointment.Status.IN_PROGRESS,
        ]
        if employee and start and end:
            overlap_exists = Appointment.objects.filter(
                employee=employee,
                status__in=active_statuses,
                start__lt=end,
                end__gt=start,
            ).exists()
            if overlap_exists:
                raise serializers.ValidationError(
                    {
                        "employee": "Pracownik ma w tym czasie inną wizytę.",
                    }
                )

        return attrs

    def create(self, validated_data: dict[str, Any]) -> Appointment:
        return Appointment.objects.create(**validated_data)


class BookingCreateSerializer(serializers.Serializer):
    """Serializer dla klienta do tworzenia rezerwacji przez endpoint /api/bookings/.

    Używa stabilnych ID obiektów (employee/service) i daty startu.
    Backend weryfikuje dostępność na podstawie wyliczonych slotów.
    """
    employee = serializers.IntegerField()
    service = serializers.IntegerField()
    start = serializers.DateTimeField()
    client_notes = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate_start(self, value: datetime) -> datetime:
        if value < timezone.now():
            raise serializers.ValidationError("Nie można umawiać wizyt w przeszłości.")
        return value


class AppointmentStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ["status", "cancellation_reason"]

    def update(self, instance: Appointment, validated_data: dict[str, Any]) -> Appointment:
        new_status = validated_data.get("status", instance.status)
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if (
            new_status == Appointment.Status.CANCELLED
            and instance.status != Appointment.Status.CANCELLED
        ):
            instance.cancelled_by = user if user and user.is_authenticated else None
            instance.cancelled_at = timezone.now()
            if "cancellation_reason" in validated_data:
                instance.cancellation_reason = validated_data["cancellation_reason"]

        instance.status = new_status
        instance.save()
        return instance


# ==================== NOTE & MEDIA SERIALIZERS ====================


class NoteSerializer(serializers.ModelSerializer):
    author_email = serializers.EmailField(source="author.email", read_only=True)

    class Meta:
        model = Note
        fields = [
            "id",
            "appointment",
            "author",
            "author_email",
            "content",
            "visible_for_client",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "author", "author_email", "created_at", "updated_at"]

    def create(self, validated_data: dict[str, Any]) -> Note:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and getattr(user, "is_authenticated", False):
            validated_data["author"] = user
        note = cast(Note, super().create(validated_data))
        return note


class MediaAssetSerializer(serializers.ModelSerializer):
    employee_full_name = serializers.CharField(
        source="employee.get_full_name", read_only=True
    )

    class Meta:
        model = MediaAsset
        fields = [
            "id",
            "employee",
            "employee_full_name",
            "file_url",
            "type",
            "file_name",
            "size_bytes",
            "is_active",
            "description",
            "mime_type",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ==================== BILLING: PAYMENT & INVOICE SERIALIZERS ====================


class PaymentSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    client_name = serializers.SerializerMethodField()
    appointment_start = serializers.DateTimeField(
        source="appointment.start", read_only=True
    )

    class Meta:
        model = Payment
        fields = [
            "id",
            "appointment",
            "client_name",
            "amount",
            "status",
            "status_display",
            "paid_at",
            "method",
            "type",
            "reference",
            "appointment_start",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_client_name(self, obj: Payment) -> str | None:
        if obj.appointment and obj.appointment.client:
            return obj.appointment.client.get_full_name()
        return None

# ==================== SERIALIZERS.PY - COMPOSITE KEY ====================

class PaymentCreateSerializer(serializers.ModelSerializer):
    # Composite key: client_number + appointment_start
    client_number = serializers.SlugRelatedField(
        slug_field='number',
        queryset=Client.objects.all(),
        write_only=True,
        error_messages={
            'does_not_exist': 'Klient o podanym numerze nie istnieje.',
            'required': 'Pole "client_number" jest wymagane.'
        }
    )

    appointment_start = serializers.DateTimeField(
        write_only=True,
        help_text="Data i czas rozpoczęcia wizyty"
    )

    class Meta:
        model = Payment
        fields = [
            "client_number",
            "appointment_start",
            "amount",
            "status",
            "method",
            "type",
            "reference"
        ]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        # Bezpośredni odczyt danych
        client = attrs.pop('client_number')
        start = attrs.pop('appointment_start')

        try:
            appointment = Appointment.objects.get(
                client=client,
                start=start
            )
            attrs['appointment'] = appointment

        except Appointment.DoesNotExist:
            raise serializers.ValidationError({
                "appointment_start": "Nie znaleziono wizyty dla klienta o tym czasie rozpoczęcia."
            })
        except Appointment.MultipleObjectsReturned:
            raise serializers.ValidationError({
                "appointment_start": "Znaleziono wiele wizyt - podaj bardziej precyzyjny czas."
            })

        if attrs.get('amount', 0) <= 0:
            raise serializers.ValidationError({
                "amount": "Kwota musi być większa od zera."
            })

        return attrs

    def validate_amount(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Kwota musi być większa od zera.")
        return value


class PaymentMarkAsPaidSerializer(serializers.Serializer):
    payment = serializers.PrimaryKeyRelatedField(
        queryset=Payment.objects.filter(status=Payment.Status.PENDING)
    )

    def save(self, **kwargs: Any) -> Payment:
        payment = cast(Payment, self.validated_data["payment"])
        if payment.status == Payment.Status.PAID:
            raise serializers.ValidationError("Płatność jest już oznaczona jako opłacona.")

        payment.status = Payment.Status.PAID
        payment.paid_at = timezone.now()
        payment.save(update_fields=["status", "paid_at"])
        return payment


class InvoiceSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.get_full_name", read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "number",
            "client",
            "client_name",
            "appointment",
            "issue_date",
            "net_amount",
            "vat_rate",
            "vat_amount",
            "gross_amount",
            "is_paid",
            "sale_date",
            "due_date",
            "paid_date",
            "pdf_file",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "number", "created_at", "updated_at"]


# ==================== NOTIFICATION & REPORT SERIALIZERS ====================


class NotificationSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.get_full_name", read_only=True)
    appointment_start = serializers.DateTimeField(
        source="appointment.start", read_only=True
    )

    class Meta:
        model = Notification
        fields = [
            "id",
            "client",
            "client_name",
            "appointment",
            "appointment_start",
            "type",
            "channel",
            "status",
            "scheduled_at",
            "subject",
            "content",
            "sent_at",
            "error_message",
            "attempts_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "sent_at",
            "error_message",
            "attempts_count",
            "created_at",
            "updated_at",
        ]


class NotificationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "client",
            "appointment",
            "type",
            "channel",
            "scheduled_at",
            "subject",
            "content",
        ]


class ReportPDFSerializer(serializers.ModelSerializer):
    generated_by_email = serializers.EmailField(
        source="generated_by.email", read_only=True
    )

    class Meta:
        model = ReportPDF
        fields = [
            "id",
            "type",
            "title",
            "file_path",
            "data_od",
            "data_do",
            "file_size",
            "generated_by",
            "generated_by_email",
            "parameters",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ==================== AUDIT & SYSTEM SETTINGS & STATS SERIALIZERS ====================


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    level_display = serializers.CharField(source="get_level_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "type",
            "level",
            "level_display",
            "created_at",
            "user",
            "user_email",
            "message",
            "adres_ip",
            "user_agent",
            "entity_type",
            "entity_id",
            "metadata",
        ]
        read_only_fields = ["id", "created_at"]


class SystemSettingsSerializer(serializers.ModelSerializer):
    last_modified_by_email = serializers.EmailField(
        source="last_modified_by.email", read_only=True
    )

    class Meta:
        model = SystemSettings
        fields = [
            "id",
            "slot_minutes",
            "buffer_minutes",
            "deposit_policy",
            "opening_hours",
            "salon_name",
            "address",
            "phone",
            "contact_email",
            "default_vat_rate",
            "maintenance_mode",
            "maintenance_message",
            "last_modified_by",
            "last_modified_by_email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "last_modified_by",
            "last_modified_by_email",
            "created_at",
            "updated_at",
        ]



class StatsSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatsSnapshot
        fields = [
            "id",
            "period",
            "total_visits",
            "date_from",
            "date_to",
            "completed_visits",
            "cancellations",
            "no_shows",
            "revenue_total",
            "revenue_deposits",
            "new_clients",
            "returning_clients",
            "employees_occupancy_avg",
            "extra_metrics",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ServiceStatisticsSerializer(serializers.Serializer):
    service = ServiceDetailSerializer(read_only=True)
    total_appointments = serializers.IntegerField(read_only=True)
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)


class EmployeeStatisticsSerializer(serializers.Serializer):
    employee = EmployeeSimpleSerializer(read_only=True)
    total_appointments = serializers.IntegerField(read_only=True)
    occupancy_percent = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

class ScheduleUpdateSerializer(serializers.ModelSerializer):
    availability_periods = AvailabilityPeriodSerializer(many=True)

    class Meta:
        model = Schedule
        fields = [
            "id",
            "status",
            "breaks",
            "availability_periods",
        ]

    def update(self, instance: Schedule, validated_data: dict) -> Schedule:
        if "availability_periods" in validated_data:
            instance.availability_periods = validated_data.pop("availability_periods")

        # Aktualizacja breaks (JSONField)
        if "breaks" in validated_data:
            instance.breaks = validated_data.pop("breaks")

        # Aktualizacja pozostałych prostych pól (np. status)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance

