from __future__ import annotations

import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
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


def _humanize_password_errors(exc: DjangoValidationError) -> list[str]:
    msgs = [str(m) for m in getattr(exc, "messages", []) or []]
    out: list[str] = []

    for s in msgs:
        s_norm = s.strip()

        if "This password is too common" in s_norm:
            out.append("To hasło jest zbyt powszechne — wybierz bardziej unikalne.")
        elif "This password is too short" in s_norm:
            out.append("Hasło jest zbyt krótkie — ustaw co najmniej 8 znaków.")
        elif "This password is entirely numeric" in s_norm:
            out.append("Hasło nie może składać się wyłącznie z cyfr.")
        elif "is too similar to the" in s_norm:
            out.append("Hasło jest zbyt podobne do danych użytkownika (login/e-mail).")
        else:
            out.append(s_norm)

    return out or ["Hasło nie spełnia wymagań bezpieczeństwa."]


def _validate_password_or_raise(value: str, *, user=None, field_name: str = "password"):
    try:
        validate_password(value, user=user)
    except DjangoValidationError as e:
        raise serializers.ValidationError({field_name: _humanize_password_errors(e)})


class UserListSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "role_display",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "username", "created_at"]


class UserDetailSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    employee_profile = serializers.SerializerMethodField()
    client_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "role_display",
            "is_active",
            "employee_profile",
            "client_profile",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "username", "created_at", "updated_at"]

    def get_employee_profile(self, obj):
        employee = getattr(obj, "employee_profile", None)
        if not employee:
            return None
        return {
            "id": employee.id,
            "employee_number": employee.employee_number,
            "full_name": employee.get_full_name(),
        }

    def get_client_profile(self, obj):
        client = getattr(obj, "client_profile", None)
        if not client:
            return None
        return {
            "id": client.id,
            "client_number": client.client_number,
            "full_name": client.get_full_name(),
        }


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "password",
            "first_name",
            "last_name",
            "email",
            "role",
        ]
        read_only_fields = ["id"]

    def validate_password(self, value):
        if value:
            temp_user = User(
                username=self.initial_data.get("username", ""),
                email=self.initial_data.get("email", ""),
            )
            _validate_password_or_raise(value, user=temp_user, field_name="password")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)

        if password:
            user.set_password(password)
        else:
            user.set_password(secrets.token_urlsafe(8))

        try:
            user.full_clean()
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message_dict)

        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "is_active"]


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
        if attrs.get("new_password") != attrs.get("new_password2"):
            raise serializers.ValidationError({"new_password2": "Hasła nie są identyczne."})

        if attrs.get("new_password") == attrs.get("old_password"):
            raise serializers.ValidationError({"new_password": "Nowe hasło musi różnić się od aktualnego."})

        user = self.context["request"].user
        _validate_password_or_raise(attrs["new_password"], user=user, field_name="new_password")
        return attrs


class PasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True)
    new_password2 = serializers.CharField(write_only=True)

    def validate(self, attrs):
        pw1 = attrs.get("new_password")
        pw2 = attrs.get("new_password2")

        if pw1 != pw2:
            raise serializers.ValidationError({"new_password2": "Hasła nie są identyczne."})

        _validate_password_or_raise(pw1, field_name="new_password")
        return attrs


class ServiceSerializer(serializers.ModelSerializer):
    duration_display = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            "id",
            "name",
            "category",
            "description",
            "price",
            "duration_minutes",
            "duration_display",
            "is_active",
            "created_at",
            "updated_at",
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
        source="skills",
    )

    email = serializers.EmailField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = EmployeeProfile
        fields = [
            "id",
            "user",
            "user_username",
            "user_email",
            "employee_number",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "skills",
            "skill_ids",
            "email",
            "password",
            "is_active",
            "appointments_count",
            "completed_appointments_count",
            "revenue_completed_total",
            "hired_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "employee_number", "created_at", "updated_at"]
        extra_kwargs = {"user": {"required": False}}

    def get_full_name(self, obj):
        return obj.get_full_name()

    def validate(self, data):
        if not self.instance:
            if not data.get("email") or not data.get("password"):
                raise serializers.ValidationError("Email i hasło są wymagane przy tworzeniu pracownika.")
            _validate_password_or_raise(data["password"], field_name="password")

        password = data.get("password")
        if self.instance and password:
            _validate_password_or_raise(password, user=self.instance.user, field_name="password")

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
                    candidate = f"pracownik-{secrets.randbelow(10 ** 8):08d}"
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
                    base = int(employee.employee_number)
                    picked = None
                    for _ in range(1000):
                        base += 1
                        candidate_num = f"{base:08d}"
                        candidate_username = f"pracownik-{candidate_num}"
                        if (
                            not EmployeeProfile.objects.filter(employee_number=candidate_num).exists()
                            and not User.objects.filter(username=candidate_username).exclude(pk=user.pk).exists()
                        ):
                            picked = (candidate_num, candidate_username)
                            break

                    if not picked:
                        raise serializers.ValidationError("Nie można wygenerować unikalnego loginu pracownika.")

                    employee.employee_number = picked[0]
                    employee.save(update_fields=["employee_number"])
                    final_username = picked[1]

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
        fields = ["id", "employee_number", "first_name", "last_name", "full_name"]
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name()


class EmployeeScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeSchedule
        fields = ["id", "employee", "weekly_hours", "created_at", "updated_at"]
        read_only_fields = ["id", "employee", "created_at", "updated_at"]

    def validate_weekly_hours(self, value):
        settings_obj = SystemSettings.get_settings()
        salon_hours = settings_obj.opening_hours or {}

        day_names_pl = {
            "mon": "Poniedziałek",
            "tue": "Wtorek",
            "wed": "Środa",
            "thu": "Czwartek",
            "fri": "Piątek",
            "sat": "Sobota",
            "sun": "Niedziela",
        }

        if not value:
            return value

        for day, periods in value.items():
            if periods:
                salon_day_periods = salon_hours.get(day)
                pretty_day = day_names_pl.get(day, day)

                if not salon_day_periods:
                    raise serializers.ValidationError(
                        _(f"Nie można zapisać grafiku na dzień: {pretty_day}, ponieważ salon jest wtedy zamknięty.")
                    )

                for p in periods:
                    emp_start = p.get("start")
                    emp_end = p.get("end")

                    if not emp_start or not emp_end:
                        continue

                    is_within_salon = False
                    for s_period in salon_day_periods:
                        s_start = s_period.get("start")
                        s_end = s_period.get("end")

                        if s_start and s_end:
                            if emp_start >= s_start and emp_end <= s_end:
                                is_within_salon = True
                                break

                    if not is_within_salon:
                        raise serializers.ValidationError(
                            _(f"W dniu: {pretty_day} godziny {emp_start}-{emp_end} wykraczają poza czas pracy salonu.")
                        )

        return value


class TimeOffSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.get_full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

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
            "employee",
            "requested_by",
            "decided_by",
            "decided_at",
            "created_at",
        ]

    def get_can_cancel(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        if obj.status != TimeOff.Status.PENDING:
            return False

        user = request.user
        role = getattr(user, "role", None)

        if role == "ADMIN":
            return True

        return role == "EMPLOYEE" and obj.employee.user_id == user.id

    def get_can_approve(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        if obj.status != TimeOff.Status.PENDING:
            return False

        user = request.user
        return getattr(user, "role", None) == "ADMIN"

    def get_can_reject(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        if obj.status != TimeOff.Status.PENDING:
            return False

        user = request.user
        return getattr(user, "role", None) == "ADMIN"

    def validate(self, attrs):
        date_from = attrs.get("date_from") or getattr(self.instance, "date_from", None)
        date_to = attrs.get("date_to") or getattr(self.instance, "date_to", None)

        if date_from and date_to and date_to < date_from:
            raise serializers.ValidationError({"date_to": "date_to nie może być wcześniejsze niż date_from."})

        return attrs


class ClientSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    user_username = serializers.CharField(source="user.username", read_only=True, allow_null=True)
    user_email = serializers.CharField(source="user.email", read_only=True, allow_null=True)

    appointments_count = serializers.IntegerField(read_only=True)

    email = serializers.EmailField(required=False, allow_null=True, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = ClientProfile
        fields = [
            "id",
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
            _validate_password_or_raise(data["password"], field_name="password")

        password = data.get("password")
        if self.instance and password and self.instance.user:
            _validate_password_or_raise(password, user=self.instance.user, field_name="password")

        user = data.get("user")
        if user and getattr(user, "role", None) != "CLIENT":
            raise serializers.ValidationError("Użytkownik musi mieć rolę CLIENT.")

        return data

    def create(self, validated_data):
        email = validated_data.get("email", None)
        password = validated_data.pop("password", None)

        with transaction.atomic():
            tmp_username = None
            for _ in range(200):
                candidate = f"klient-{secrets.randbelow(10 ** 8):08d}"
                if not User.objects.filter(username=candidate).exists():
                    tmp_username = candidate
                    break
            if not tmp_username:
                raise serializers.ValidationError("Nie można wygenerować unikalnego loginu klienta.")

            user = User(
                username=tmp_username,
                email=email or "",
                first_name=validated_data.get("first_name", ""),
                last_name=validated_data.get("last_name", ""),
                role="CLIENT",
                is_active=True,
            )
            if password:
                user.set_password(password)
            else:
                user.set_password(secrets.token_urlsafe(10))

            user.full_clean()
            user.save()

            client = ClientProfile.objects.create(user=user, **validated_data)

            if not client.client_number:
                raise serializers.ValidationError("Nie nadano client_number (sprawdź signals.py).")

            final_username = f"klient-{client.client_number}"

            if user.username != final_username:
                if User.objects.filter(username=final_username).exclude(pk=user.pk).exists():
                    base = int(client.client_number)
                    picked = None
                    for _ in range(1000):
                        base += 1
                        candidate_num = f"{base:08d}"
                        candidate_username = f"klient-{candidate_num}"
                        if (
                            not ClientProfile.objects.filter(client_number=candidate_num).exists()
                            and not User.objects.filter(username=candidate_username).exclude(pk=user.pk).exists()
                        ):
                            picked = (candidate_num, candidate_username)
                            break

                    if not picked:
                        raise serializers.ValidationError("Nie można wygenerować unikalnego loginu klienta.")

                    client.client_number = picked[0]
                    client.save(update_fields=["client_number"])
                    final_username = picked[1]

                user.username = final_username
                user.full_clean()
                user.save(update_fields=["username"])

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
            "id",
            "client_number",
            "first_name",
            "last_name",
            "email",
            "phone",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class AppointmentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.get_full_name", read_only=True)
    employee_name = serializers.CharField(source="employee.get_full_name", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)
    service_price = serializers.DecimalField(source="service.price", max_digits=10, decimal_places=2, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    can_confirm = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    can_complete = serializers.SerializerMethodField()
    can_no_show = serializers.SerializerMethodField()

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
            "can_confirm",
            "can_cancel",
            "can_complete",
            "can_no_show",
            "internal_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_can_confirm(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        role = getattr(request.user, "role", None)
        if role not in ("ADMIN", "EMPLOYEE"):
            return False

        if obj.status != Appointment.Status.PENDING:
            return False

        return obj.start > timezone.now()

    def get_can_cancel(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        if obj.status not in (Appointment.Status.PENDING, Appointment.Status.CONFIRMED):
            return False

        if obj.start <= timezone.now():
            return False

        user = request.user
        role = getattr(user, "role", None)

        if role in ("ADMIN", "EMPLOYEE"):
            return True

        if role == "CLIENT":
            client = getattr(user, "client_profile", None)
            return bool(client and obj.client_id == client.id)

        return False

    def get_can_complete(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        role = getattr(request.user, "role", None)
        if role not in ("ADMIN", "EMPLOYEE"):
            return False

        if obj.status not in (Appointment.Status.PENDING, Appointment.Status.CONFIRMED):
            return False

        return obj.end <= timezone.now()

    def get_can_no_show(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        role = getattr(request.user, "role", None)
        if role not in ("ADMIN", "EMPLOYEE"):
            return False

        if obj.status != Appointment.Status.CONFIRMED:
            return False

        return obj.end <= timezone.now()

    def validate(self, attrs):
        if self.instance is None:
            if attrs.get("client", None) is None:
                raise serializers.ValidationError({"client": "Klient jest wymagany."})

        if self.instance is not None and "client" in attrs:
            if attrs.get("client", None) is None:
                raise serializers.ValidationError({"client": "Nie można usunąć klienta z wizyty."})

        start = attrs.get("start") or getattr(self.instance, "start", None)
        end = attrs.get("end") or getattr(self.instance, "end", None)

        if start and end and end <= start:
            raise serializers.ValidationError({"end": "Zakończenie wizyty musi być później niż rozpoczęcie."})

        if self.instance and self.instance.start <= timezone.now():
            for field, new_value in attrs.items():
                if field == "internal_notes":
                    continue

                old_value = getattr(self.instance, field)

                if hasattr(old_value, "id"):
                    old_val_to_cmp = old_value.id
                    new_val_to_cmp = new_value.id if hasattr(new_value, "id") else new_value
                else:
                    old_val_to_cmp = old_value
                    new_val_to_cmp = new_value

                if new_val_to_cmp != old_val_to_cmp:
                    raise serializers.ValidationError({"detail": f"Wizyta już się rozpoczęła. Nie można zmienić pola: {field}."})

        return attrs


class SystemSettingsSerializer(serializers.ModelSerializer):
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True, allow_null=True)

    class Meta:
        model = SystemSettings
        fields = [
            "id",
            "salon_name",
            "slot_minutes",
            "buffer_minutes",
            "opening_hours",
            "updated_at",
            "updated_by",
            "updated_by_username",
        ]
        read_only_fields = ["id", "updated_at", "updated_by"]


class SystemLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    performed_by_username = serializers.CharField(source="performed_by.username", read_only=True, allow_null=True)
    target_user_username = serializers.CharField(source="target_user.username", read_only=True, allow_null=True)

    class Meta:
        model = SystemLog
        fields = [
            "id",
            "action",
            "action_display",
            "performed_by",
            "performed_by_username",
            "target_user",
            "target_user_username",
            "timestamp",
        ]
        read_only_fields = fields


class BookingCreateSerializer(serializers.Serializer):
    service_id = serializers.IntegerField(required=True)
    employee_id = serializers.IntegerField(required=True)
    start = serializers.DateTimeField(required=True)
    client_id = serializers.IntegerField(required=False)

    @transaction.atomic
    def validate(self, data):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError({"detail": "Musisz być zalogowany aby zarezerwować wizytę."})

        user = request.user
        role = getattr(user, "role", None)

        if role == "EMPLOYEE":
            employee_profile = getattr(user, "employee_profile", None)
            if not employee_profile:
                raise serializers.ValidationError({"detail": "Brak profilu pracownika."})

            if data.get("employee_id") and int(data["employee_id"]) != employee_profile.id:
                raise serializers.ValidationError({"employee_id": "Jako pracownik możesz tworzyć wizyty tylko dla siebie."})

        if role == "CLIENT":
            if data.get("client_id") not in (None, "", 0):
                raise serializers.ValidationError({"client_id": "Klient nie może rezerwować wizyt dla innych klientów."})

            client = getattr(user, "client_profile", None)
            if not client:
                raise serializers.ValidationError({"client_id": "Użytkownik nie ma profilu klienta."})

        elif role in ("ADMIN", "EMPLOYEE"):
            if not data.get("client_id"):
                raise serializers.ValidationError({"client_id": "Wymagane dla ADMIN/EMPLOYEE."})
            try:
                client = ClientProfile.objects.get(pk=int(data["client_id"]), is_active=True)
            except (ClientProfile.DoesNotExist, ValueError, TypeError):
                raise serializers.ValidationError({"client_id": "Nie znaleziono aktywnego klienta."})

        else:
            raise serializers.ValidationError({"detail": "Brak uprawnień do rezerwacji."})

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

        if start < timezone.now():
            raise serializers.ValidationError({"start": "Nie można rezerwować wizyt w przeszłości."})

        if not employee.skills.filter(id=service.id).exists():
            raise serializers.ValidationError({"employee_id": "Ten pracownik nie wykonuje wybranej usługi."})

        settings_obj = SystemSettings.get_settings()
        buffer_minutes = int(settings_obj.buffer_minutes or 0)
        duration = timedelta(minutes=int(service.duration_minutes) + buffer_minutes)
        end = start + duration

        if TimeOff.objects.filter(
            employee=employee,
            status=TimeOff.Status.APPROVED,
            date_from__lte=start.date(),
            date_to__gte=start.date(),
        ).exists():
            raise serializers.ValidationError({"start": "Pracownik jest nieobecny w tym dniu."})

        if Appointment.objects.filter(
            employee=employee,
            start__lt=end,
            end__gt=start,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
        ).exists():
            raise serializers.ValidationError({"start": "Ten pracownik ma już zajęty termin."})

        if Appointment.objects.filter(
            client=client,
            start__lt=end,
            end__gt=start,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
        ).exists():
            raise serializers.ValidationError({"start": "Masz już zarezerwowaną wizytę w tym czasie."})

        data.update(
            {
                "start": start,
                "end": end,
                "client": client,
                "service": service,
                "employee": employee,
            }
        )
        return data

    def create(self, validated_data):
        start = validated_data["start"]
        end = validated_data["end"]

        try:
            employee = EmployeeProfile.objects.select_for_update().get(
                pk=validated_data["employee"].pk,
                is_active=True,
            )
        except EmployeeProfile.DoesNotExist:
            raise serializers.ValidationError(
                {"employee_id": "Nie znaleziono aktywnego pracownika."}
            )

        try:
            client = ClientProfile.objects.select_for_update().get(
                pk=validated_data["client"].pk,
                is_active=True,
            )
        except ClientProfile.DoesNotExist:
            raise serializers.ValidationError(
                {"client_id": "Nie znaleziono aktywnego klienta."}
            )

        if (
                TimeOff.objects.select_for_update()
                        .filter(
                    employee=employee,
                    date_from__lt=end,
                    date_to__gt=start,
                )
                        .exists()
        ):
            raise serializers.ValidationError(
                {"non_field_errors": "Wybrany termin jest niedostępny."}
            )

        if (
                Appointment.objects.select_for_update()
                        .filter(
                    employee=employee,
                    start__lt=end,
                    end__gt=start,
                    status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
                )
                        .exists()
        ):
            raise serializers.ValidationError(
                {"non_field_errors": "Wybrany termin jest już zajęty."}
            )


        request = self.context.get("request")
        user_role = getattr(request.user, "role", None) if request else None


        if user_role == "CLIENT":
            initial_status = Appointment.Status.PENDING
        else:
            initial_status = Appointment.Status.CONFIRMED

        appointment = Appointment.objects.create(
            employee=employee,
            client=client,
            service=validated_data["service"],
            start=start,
            end=end,
            status=initial_status,
        )

        return appointment