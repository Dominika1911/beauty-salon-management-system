from decimal import Decimal
import secrets

from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import serializers

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

    def get_account_status(self, obj):
        if getattr(obj, "account_locked_until", None) and obj.account_locked_until > timezone.now():
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

    def create(self, validated_data):
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

    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Hasło musi mieć co najmniej 8 znaków.")
        return value


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Brak uwierzytelnionego użytkownika.")
        if not user.check_password(value):
            raise serializers.ValidationError("Niepoprawne stare hasło.")
        return value

    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Hasło musi mieć co najmniej 8 znaków.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.failed_login_attempts = 0
        user.account_locked_until = None
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

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Cena musi być większa od zera.")
        return value

    def validate_duration(self, value):
        if value.total_seconds() <= 0:
            raise serializers.ValidationError("Czas trwania musi być dodatni.")
        return value


# ==================== EMPLOYEE SERIALIZERS ====================


class EmployeeSimpleSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)

    class Meta:
        model = Employee
        fields = ["id", "number", "full_name"]
        read_only_fields = ["id", "number", "full_name"]


class EmployeeListSerializer(serializers.ModelSerializer):
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
            "user",
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
            "user",
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

    def validate_user(self, value):
        if not hasattr(value, "is_salon_employee") or not value.is_salon_employee():
            raise serializers.ValidationError("Wybrane konto nie ma roli pracownika.")
        return value


class EmployeeCreateUpdateSerializer(serializers.ModelSerializer):
    skill_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Service.objects.all(),
        source="skills",
        write_only=True,
        required=False,
    )

    class Meta:
        model = Employee
        fields = [
            "user",
            "number",
            "first_name",
            "last_name",
            "phone",
            "hired_at",
            "average_rating",
            "is_active",
            "skill_ids",
        ]
        read_only_fields = ["number", "average_rating"]

    def validate_user(self, value):
        if not hasattr(value, "is_salon_employee") or not value.is_salon_employee():
            raise serializers.ValidationError("Wybrane konto nie ma roli pracownika.")
        return value


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

    def get_is_deleted(self, obj):
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

    def get_is_deleted(self, obj):
        return getattr(obj, "deleted_at", None) is not None


class ClientCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            "first_name",
            "last_name",
            "email",
            "phone",
            "user",
            "marketing_consent",
            "preferred_contact",
            "internal_notes",
        ]

    def validate_user(self, value):
        if value and (not hasattr(value, "is_salon_client") or not value.is_salon_client()):
            raise serializers.ValidationError("Wybrane konto nie ma roli klienta.")
        return value


class ClientSoftDeleteSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.filter(deleted_at__isnull=True)
    )

    def save(self, **kwargs):
        client = self.validated_data["client"]
        client.soft_delete()
        return client


# ==================== SCHEDULE & TIME OFF SERIALIZERS ====================


class ScheduleSerializer(serializers.ModelSerializer):
    employee_full_name = serializers.CharField(
        source="employee.get_full_name", read_only=True
    )

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

    def get_days(self, obj):
        if obj.date_from and obj.date_to:
            return (obj.date_to - obj.date_from).days + 1
        return None


class TimeOffApproveSerializer(serializers.Serializer):
    time_off = serializers.PrimaryKeyRelatedField(
        queryset=TimeOff.objects.filter(status=TimeOff.Status.PENDING)
    )

    def save(self, **kwargs):
        time_off = self.validated_data["time_off"]
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if time_off.status != TimeOff.Status.PENDING:
            raise serializers.ValidationError(
                "Ten wniosek urlopowy został już rozpatrzony."
            )

        time_off.status = TimeOff.Status.APPROVED
        time_off.approved_by = user if user and user.is_authenticated else None
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

    def validate_start(self, value):
        if value < timezone.now():
            raise serializers.ValidationError(
                "Nie można umawiać wizyt w przeszłości."
            )
        return value

    def validate(self, attrs):
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

    def create(self, validated_data):
        return Appointment.objects.create(**validated_data)


class AppointmentStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ["status", "cancellation_reason"]

    def update(self, instance, validated_data):
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

    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            validated_data["author"] = user
        return super().create(validated_data)


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

    def get_client_name(self, obj):
        if obj.appointment and obj.appointment.client:
            return obj.appointment.client.get_full_name()
        return None


class PaymentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["appointment", "amount", "status", "method", "type", "reference"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Kwota musi być większa od zera.")
        return value


class PaymentMarkAsPaidSerializer(serializers.Serializer):
    payment = serializers.PrimaryKeyRelatedField(
        queryset=Payment.objects.filter(status=Payment.Status.PENDING)
    )

    def save(self, **kwargs):
        payment = self.validated_data["payment"]
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
            "timestamp",
            "user",
            "user_email",
            "message",
            "adres_ip",
            "user_agent",
            "entity_type",
            "entity_id",
            "metadata",
        ]
        read_only_fields = ["id"]


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
