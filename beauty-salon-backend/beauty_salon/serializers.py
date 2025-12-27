from __future__ import annotations

import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

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

User = get_user_model()

# =============================================================================
# USER SERIALIZERS
# =============================================================================

class UserListSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email",
            "role", "role_display", "is_active", "created_at"
        ]
        read_only_fields = ["id", "username", "created_at"]


class UserDetailSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    employee_profile = serializers.SerializerMethodField()
    client_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email",
            "role", "role_display", "is_active",
            "employee_profile", "client_profile",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "username", "created_at", "updated_at"]

    def get_employee_profile(self, obj):
        if hasattr(obj, "employee_profile"):
            return {
                "id": obj.employee_profile.id,
                "employee_number": obj.employee_profile.employee_number,
                "full_name": obj.employee_profile.get_full_name(),
            }
        return None

    def get_client_profile(self, obj):
        if hasattr(obj, "client_profile"):
            return {
                "id": obj.client_profile.id,
                "client_number": obj.client_profile.client_number,
                "full_name": obj.client_profile.get_full_name(),
            }
        return None


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ["id", "username", "password", "first_name", "last_name", "email", "role"]
        read_only_fields = ["id"]

    def validate_password(self, value):
        if value:
            # lepsza walidacja (np. podobieństwo do username)
            temp_user = User(
                username=self.initial_data.get("username", ""),
                email=self.initial_data.get("email", ""),
            )
            validate_password(value, user=temp_user)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)

        if password:
            user.set_password(password)
        else:
            user.set_password(secrets.token_urlsafe(8))

        user.full_clean()
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "is_active"]


# =============================================================================
# PASSWORDS
# =============================================================================

class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    new_password2 = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Nieprawidłowe aktualne hasło.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError(
                {"new_password2": "Hasła nie są identyczne."}
            )

        if attrs["new_password"] == attrs["old_password"]:
            raise serializers.ValidationError(
                {"new_password": "Nowe hasło musi różnić się od aktualnego."}
            )

        user = self.context["request"].user
        validate_password(attrs["new_password"], user=user)
        return attrs


class PasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True)
    new_password2 = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError(
                {"new_password2": "Hasła nie są identyczne."}
            )

        validate_password(attrs["new_password"])
        return attrs


# =============================================================================
# SERVICE SERIALIZERS
# =============================================================================

class ServiceSerializer(serializers.ModelSerializer):
    duration_display = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            "id", "name", "category", "description",
            "price", "duration_minutes", "duration_display",
            "is_active", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_duration_display(self, obj):
        hours = obj.duration_minutes // 60
        minutes = obj.duration_minutes % 60
        if hours > 0 and minutes > 0:
            return f"{hours}h {minutes}min"
        if hours > 0:
            return f"{hours}h"
        return f"{minutes}min"


# =============================================================================
# EMPLOYEE SERIALIZERS
# =============================================================================

class EmployeeSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)

    full_name = serializers.SerializerMethodField(read_only=True)

    appointments_count = serializers.IntegerField(read_only=True)
    completed_appointments_count = serializers.IntegerField(read_only=True)
    revenue_completed_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    skills = ServiceSerializer(many=True, read_only=True)
    skill_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Service.objects.filter(is_active=True),
        write_only=True,
        required=False,
        source="skills"
    )

    email = serializers.EmailField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = EmployeeProfile
        fields = [
            "id", "user", "user_username", "user_email",
            "employee_number", "first_name", "last_name", "full_name", "phone",
            "skills", "skill_ids",
            "email", "password",
            "is_active",
            "appointments_count", "completed_appointments_count", "revenue_completed_total",
            "hired_at",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "employee_number", "created_at", "updated_at"]
        extra_kwargs = {"user": {"required": False}}

    def get_full_name(self, obj):
        return obj.get_full_name()

    def validate(self, data):
        if not self.instance:
            if not data.get("email") or not data.get("password"):
                raise serializers.ValidationError("Email i hasło są wymagane przy tworzeniu pracownika.")
            validate_password(data["password"])

        password = data.get("password")
        if self.instance and password:
            validate_password(password, user=self.instance.user)

        user = data.get("user")
        if user and getattr(user, "role", None) != "EMPLOYEE":
            raise serializers.ValidationError("Użytkownik musi mieć rolę EMPLOYEE.")

        return data

    def create(self, validated_data):
        email = validated_data.pop("email", None)
        password = validated_data.pop("password", None)
        skills_data = validated_data.pop("skills", [])

        with transaction.atomic():
            user = validated_data.pop("user", None)
            if not user:
                tmp_username = None
                for _ in range(200):
                    candidate = f"pracownik-{secrets.randbelow(10**8):08d}"
                    if not User.objects.filter(username=candidate).exists():
                        tmp_username = candidate
                        break
                if not tmp_username:
                    raise serializers.ValidationError("Nie można wygenerować unikalnego loginu pracownika.")

                user = User(
                    username=tmp_username,
                    email=email or "",
                    first_name=validated_data.get("first_name", ""),
                    last_name=validated_data.get("last_name", ""),
                    role="EMPLOYEE",
                    is_active=True,
                )
                if password:
                    user.set_password(password)
                else:
                    user.set_password(secrets.token_urlsafe(10))

                user.full_clean()
                user.save()

            employee = EmployeeProfile.objects.create(user=user, **validated_data)

            if not employee.employee_number:
                raise serializers.ValidationError("Nie nadano employee_number (sprawdź signals.py).")

            final_username = f"pracownik-{employee.employee_number}"
            if user.username != final_username:
                if User.objects.filter(username=final_username).exclude(pk=user.pk).exists():
                    raise serializers.ValidationError("Login pracownika już istnieje.")
                user.username = final_username
                user.full_clean()
                user.save(update_fields=["username"])

            if skills_data:
                employee.skills.set(skills_data)

        return employee

    def update(self, instance, validated_data):
        skills_data = validated_data.pop("skills", None)
        email = validated_data.pop("email", None)
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if skills_data is not None:
            instance.skills.set(skills_data)

        user = instance.user
        user_changed = False

        if "first_name" in validated_data:
            user.first_name = instance.first_name
            user_changed = True
        if "last_name" in validated_data:
            user.last_name = instance.last_name
            user_changed = True

        if email is not None:
            user.email = email
            user_changed = True

        if password:
            user.set_password(password)
            user_changed = True

        if user_changed:
            user.full_clean()
            user.save()

        return instance


class EmployeePublicSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = EmployeeProfile
        fields = ["id", "first_name", "last_name", "full_name"]
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name()


class EmployeeScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeSchedule
        fields = ["id", "employee", "weekly_hours", "created_at", "updated_at"]
        read_only_fields = ["id", "employee", "created_at", "updated_at"]


# =============================================================================
# TIME OFF SERIALIZER
# =============================================================================

class TimeOffSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.get_full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    # 🔥 FLAGS
    can_cancel = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()
    can_reject = serializers.SerializerMethodField()

    class Meta:
        model = TimeOff
        fields = [
            "id",
            "employee",
            "employee_name",
            "date_from",
            "date_to",
            "reason",
            "status",
            "status_display",
            "can_cancel",
            "can_approve",
            "can_reject",
            "requested_by",
            "decided_by",
            "decided_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "requested_by",
            "decided_by",
            "decided_at",
            "created_at",
        ]

    # =========================
    # FLAGS LOGIC
    # =========================

    def get_can_cancel(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return False

        if obj.status != TimeOff.Status.PENDING:
            return False

        user = request.user
        role = getattr(user, "role", None)

        # ADMIN/staff: może anulować każdy PENDING
        if role == "ADMIN" or getattr(user, "is_staff", False):
            return True

        # EMPLOYEE: tylko własny PENDING
        return role == "EMPLOYEE" and obj.employee.user_id == user.id

    def get_can_approve(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return False

        if obj.status != TimeOff.Status.PENDING:
            return False

        user = request.user
        role = getattr(user, "role", None)

        return role == "ADMIN" or getattr(user, "is_staff", False)

    def get_can_reject(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return False

        if obj.status != TimeOff.Status.PENDING:
            return False

        user = request.user
        role = getattr(user, "role", None)

        return role == "ADMIN" or getattr(user, "is_staff", False)


# =============================================================================
# CLIENT SERIALIZERS
# =============================================================================

class ClientSerializer(serializers.ModelSerializer):
    # 🔑 KLUCZOWE DLA FRONTENDU (reset hasła po user.id)
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    user_username = serializers.CharField(
        source="user.username",
        read_only=True,
        allow_null=True
    )
    user_email = serializers.CharField(
        source="user.email",
        read_only=True,
        allow_null=True
    )

    appointments_count = serializers.IntegerField(read_only=True)

    email = serializers.EmailField(required=False, allow_null=True, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = ClientProfile
        fields = [
            "id",

            # relacja z User
            "user_id",
            "user_username",
            "user_email",

            "client_number",
            "first_name",
            "last_name",

            "email",
            "phone",
            "internal_notes",

            "password",
            "is_active",

            "appointments_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "client_number",
            "created_at",
            "updated_at",
        ]

        extra_kwargs = {"user": {"required": False}}

    def validate(self, data):
        if not self.instance:
            if "email" not in data or "password" not in data:
                raise serializers.ValidationError("Email i hasło są wymagane przy tworzeniu klienta.")
            validate_password(data["password"])

        password = data.get("password")
        if self.instance and password and self.instance.user:
            validate_password(password, user=self.instance.user)

        user = data.get("user")
        if user and user.role != "CLIENT":
            raise serializers.ValidationError("Użytkownik musi mieć rolę CLIENT.")

        return data

    def create(self, validated_data):
        email = validated_data.get("email", None)
        password = validated_data.pop("password", None)

        with transaction.atomic():
            client = ClientProfile.objects.create(**validated_data)

            if not client.client_number:
                raise serializers.ValidationError("Nie nadano client_number (sprawdź signals.py).")

            if not client.user:
                username = f"klient-{client.client_number}"
                if User.objects.filter(username=username).exists():
                    raise serializers.ValidationError("Użytkownik dla tego client_number już istnieje.")

                user = User(
                    username=username,
                    email=email or client.email or "",
                    first_name=client.first_name,
                    last_name=client.last_name,
                    role="CLIENT",
                    is_active=True
                )
                if password:
                    user.set_password(password)
                else:
                    user.set_password(secrets.token_urlsafe(10))

                user.full_clean()
                user.save()

                client.user = user
                client.save(update_fields=["user"])
            else:
                if client.user.role != "CLIENT":
                    raise serializers.ValidationError("Użytkownik musi mieć rolę CLIENT.")

        return client

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        user = instance.user
        if user:
            user_changed = False

            if "first_name" in validated_data:
                user.first_name = instance.first_name
                user_changed = True
            if "last_name" in validated_data:
                user.last_name = instance.last_name
                user_changed = True

            if "email" in validated_data:
                user.email = instance.email or ""
                user_changed = True

            if password:
                user.set_password(password)
                user_changed = True

            if user_changed:
                user.full_clean()
                user.save()

        return instance


class ClientPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientProfile
        fields = [
            "id", "client_number", "first_name", "last_name",
            "email", "phone", "is_active", "created_at", "updated_at"
        ]
        read_only_fields = fields


# =============================================================================
# APPOINTMENT SERIALIZERS
# =============================================================================

class AppointmentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(
        source="client.get_full_name",
        read_only=True,
        allow_null=True,
    )
    employee_name = serializers.CharField(
        source="employee.get_full_name",
        read_only=True,
    )
    service_name = serializers.CharField(
        source="service.name",
        read_only=True,
    )
    service_price = serializers.DecimalField(
        source="service.price",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    # 🔥 UI permissions (single source of truth)
    can_confirm = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    can_complete = serializers.SerializerMethodField()

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
            "service_price",

            "start",
            "end",

            "status",
            "status_display",

            # 🔥 UI flags
            "can_confirm",
            "can_cancel",
            "can_complete",

            "internal_notes",

            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]

    # ---------------------------------------------------------------------
    # UI permission helpers (POPRAWIONE)
    # ---------------------------------------------------------------------

    def get_can_confirm(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return False

        role = getattr(request.user, "role", None)

        # 1:1 jak IsAdminOrEmployee
        if role not in ["ADMIN", "EMPLOYEE"]:
            return False

        return obj.status == Appointment.Status.PENDING

    def get_can_cancel(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return False

        if obj.status not in (Appointment.Status.PENDING, Appointment.Status.CONFIRMED):
            return False

        user = request.user
        role = getattr(user, "role", None)

        # 1:1 jak CanCancelAppointment
        if role in ["ADMIN", "EMPLOYEE"]:
            return True

        if role == "CLIENT":
            client = getattr(user, "client_profile", None)
            return client is not None and obj.client_id == client.id

        return False

    def get_can_complete(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return False

        role = getattr(request.user, "role", None)

        # 1:1 jak IsAdminOrEmployee
        if role not in ["ADMIN", "EMPLOYEE"]:
            return False

        return obj.status in (Appointment.Status.PENDING, Appointment.Status.CONFIRMED)

    # ---------------------------------------------------------------------
    # Validation (bez zmian)
    # ---------------------------------------------------------------------

    def validate(self, data):
        start = data.get("start")
        end = data.get("end")

        if self.instance:
            if start is None:
                start = self.instance.start
            if end is None:
                end = self.instance.end

        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end": "Czas zakończenia musi być po czasie rozpoczęcia."}
            )

        employee = data.get("employee") or (
            self.instance.employee if self.instance else None
        )
        client = data.get("client") or (
            self.instance.client if self.instance else None
        )

        if employee and start and end:
            conflicts = (
                Appointment.objects
                .filter(
                    employee=employee,
                    start__lt=end,
                    end__gt=start,
                    status__in=[
                        Appointment.Status.PENDING,
                        Appointment.Status.CONFIRMED,
                    ],
                )
            )
            if self.instance:
                conflicts = conflicts.exclude(id=self.instance.id)
            if conflicts.exists():
                raise serializers.ValidationError(
                    {"employee": "Pracownik ma już zajęty termin w tym czasie."}
                )

        if client and start and end:
            client_conflicts = (
                Appointment.objects
                .filter(
                    client=client,
                    start__lt=end,
                    end__gt=start,
                    status__in=[
                        Appointment.Status.PENDING,
                        Appointment.Status.CONFIRMED,
                    ],
                )
            )
            if self.instance:
                client_conflicts = client_conflicts.exclude(id=self.instance.id)
            if client_conflicts.exists():
                raise serializers.ValidationError(
                    {"client": "Klient ma już zarezerwowaną wizytę w tym czasie."}
                )

        return data

# =============================================================================
# SYSTEM SETTINGS SERIALIZERS
# =============================================================================

class SystemSettingsSerializer(serializers.ModelSerializer):
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True, allow_null=True)

    class Meta:
        model = SystemSettings
        fields = [
            "id", "salon_name", "slot_minutes", "buffer_minutes",
            "opening_hours", "updated_at", "updated_by", "updated_by_username"
        ]
        read_only_fields = ["id", "updated_at", "updated_by"]


# =============================================================================
# SYSTEM LOG SERIALIZERS
# =============================================================================

class SystemLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    performed_by_username = serializers.CharField(source="performed_by.username", read_only=True, allow_null=True)
    target_user_username = serializers.CharField(source="target_user.username", read_only=True, allow_null=True)

    class Meta:
        model = SystemLog
        fields = [
            "id", "action", "action_display",
            "performed_by", "performed_by_username",
            "target_user", "target_user_username",
            "timestamp"
        ]
        read_only_fields = fields


# =============================================================================
# BOOKING SERIALIZER (SPÓJNY Z ROLE)
# =============================================================================

class BookingCreateSerializer(serializers.Serializer):
    service_id = serializers.IntegerField(required=True)
    employee_id = serializers.IntegerField(required=True)
    start = serializers.DateTimeField(required=True)
    client_id = serializers.IntegerField(required=False)

    def validate(self, data):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Musisz być zalogowany aby zarezerwować wizytę.")

        user = request.user
        role = getattr(user, "role", None)

        if role == "CLIENT":
            client = getattr(user, "client_profile", None)
            if not client:
                raise serializers.ValidationError({"client_id": "Użytkownik nie ma profilu klienta."})
            data["client"] = client
        elif role in ["ADMIN", "EMPLOYEE"]:
            if not data.get("client_id"):
                raise serializers.ValidationError({"client_id": "Wymagane dla ADMIN/EMPLOYEE."})
            try:
                client = ClientProfile.objects.get(pk=int(data["client_id"]), is_active=True)
            except Exception:
                raise serializers.ValidationError({"client_id": "Nie znaleziono klienta."})
        else:
            raise serializers.ValidationError("Brak uprawnień do rezerwacji.")

        try:
            service = Service.objects.get(id=data["service_id"], is_active=True)
        except Service.DoesNotExist:
            raise serializers.ValidationError({"service_id": "Nie znaleziono usługi."})

        try:
            employee = EmployeeProfile.objects.get(id=data["employee_id"], is_active=True)
        except EmployeeProfile.DoesNotExist:
            raise serializers.ValidationError({"employee_id": "Nie znaleziono pracownika."})

        start = data.get("start")
        if timezone.is_naive(start):
            start = timezone.make_aware(start)
        data["start"] = start

        if start < timezone.now():
            raise serializers.ValidationError({"start": "Nie można rezerwować wizyt w przeszłości."})

        if not employee.skills.filter(id=service.id).exists():
            raise serializers.ValidationError({"employee_id": "Ten pracownik nie wykonuje wybranej usługi."})

        settings = SystemSettings.get_settings()
        buffer_minutes = int(settings.buffer_minutes or 0)
        duration = timedelta(minutes=int(service.duration_minutes) + buffer_minutes)
        end = start + duration

        if TimeOff.objects.filter(
            employee=employee,
            status=TimeOff.Status.APPROVED,
            date_from__lte=start.date(),
            date_to__gte=start.date()
        ).exists():
            raise serializers.ValidationError({"start": "Pracownik jest nieobecny w tym dniu."})

        if Appointment.objects.filter(
                employee=employee, start__lt=end, end__gt=start,
                status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED]
        ).exists():
            raise serializers.ValidationError({"start": "Ten pracownik ma już zajęty termin."})

        if Appointment.objects.filter(
                client=client, start__lt=end, end__gt=start,
                status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED]
        ).exists():
            raise serializers.ValidationError({"start": "Masz już zarezerwowaną wizytę w tym czasie."})

        data.update({
            "end": end,
            "client": client,
            "service": service,
            "employee": employee,
        })
        return data

    def create(self, validated_data):
        start = validated_data["start"]
        end = validated_data["end"]

        employee = EmployeeProfile.objects.select_for_update().get(pk=validated_data["employee"].pk, is_active=True)
        client = ClientProfile.objects.select_for_update().get(pk=validated_data["client"].pk, is_active=True)

        if TimeOff.objects.select_for_update().filter(
                employee=employee,
                status=TimeOff.Status.APPROVED,
                date_from__lte=start.date(),
                date_to__gte=start.date(),
        ).exists():
            raise serializers.ValidationError(
                {"start": "Pracownik jest nieobecny w tym dniu (zmiana w trakcie rezerwacji)."}
            )

        emp_conflicts = (
            Appointment.objects
            .select_for_update()
            .filter(
                employee=employee,
                start__lt=end,
                end__gt=start,
                status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
            )
        )
        if emp_conflicts.exists():
            raise serializers.ValidationError({"start": "Niestety, ten termin został właśnie zarezerwowany."})

        client_conflicts = (
            Appointment.objects
            .select_for_update()
            .filter(
                client=client,
                start__lt=end,
                end__gt=start,
                status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
            )
        )
        if client_conflicts.exists():
            raise serializers.ValidationError({"start": "Masz już wizytę w tym czasie (równoległa rezerwacja)."})

        return Appointment.objects.create(
            client=client,
            employee=employee,
            service=validated_data["service"],
            start=start,
            end=end,
            status=Appointment.Status.PENDING,
        )
