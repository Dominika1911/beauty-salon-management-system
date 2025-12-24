from __future__ import annotations

import re
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Q, UniqueConstraint
from django.utils.translation import gettext_lazy as _


# =============================================================================
# GLOBAL VALIDATORS / PATTERNS
# =============================================================================

phone_validator = RegexValidator(
    regex=r"^\+?\d{9,15}$",
    message="Phone must be 9–15 digits, optional leading +.",
)

employee_number_validator = RegexValidator(
    regex=r"^\d{8}$",
    message="Employee number must be exactly 8 digits (e.g. 00000001).",
)

client_number_validator = RegexValidator(
    regex=r"^\d{8}$",
    message="Client number must be exactly 8 digits (e.g. 00000001).",
)

USERNAME_PATTERN = re.compile(
    r"^(?:[a-z]{2,30}\.[a-z]{2,30}|pracownik-\d{8}|admin-\d{8}|klient-\d{8})$"
)


# =============================================================================
# USER (auth + roles)
# =============================================================================

class CustomUser(AbstractUser):
    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    class Role(models.TextChoices):
        ADMIN = "ADMIN", _("Administrator")
        EMPLOYEE = "EMPLOYEE", _("Pracownik")
        CLIENT = "CLIENT", _("Klient")

    username = models.CharField(max_length=30, unique=True, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CLIENT)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["pk"]

    def __str__(self) -> str:
        return f"{self.username} - {self.get_role_display()}"

    @property
    def is_admin_role(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def is_employee(self) -> bool:
        return self.role == self.Role.EMPLOYEE

    @property
    def is_client(self) -> bool:
        return self.role == self.Role.CLIENT

    def clean(self):
        super().clean()

        internal = (self.role in [self.Role.ADMIN, self.Role.EMPLOYEE]) or self.is_staff or self.is_superuser

        if internal and not self.username:
            raise ValidationError({"username": "Username is required for internal users (admin/employee)."})

        # klient może nie mieć username
        if not internal and not self.username:
            return

        username = (self.username or "").strip().lower()

        if not USERNAME_PATTERN.match(username):
            raise ValidationError({
                "username": (
                    "Username must match: "
                    "'imie.nazwisko' or 'pracownik-00000001' or 'admin-00000001' or 'klient-00000001'."
                )
            })

        self.username = username


# =============================================================================
# SERVICES
# =============================================================================

class Service(models.Model):
    name = models.CharField(max_length=255, unique=True)
    category = models.CharField(max_length=100, blank=True, db_index=True)
    description = models.TextField(blank=True)

    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    duration_minutes = models.PositiveIntegerField(validators=[MinValueValidator(5)])

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["pk"]
        indexes = [
            models.Index(fields=["category", "name"]),
        ]

    def __str__(self) -> str:
        return self.name

    @property
    def duration(self) -> timedelta:
        return timedelta(minutes=self.duration_minutes)


# =============================================================================
# PROFILES
# =============================================================================

class EmployeeProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="employee_profile")

    employee_number = models.CharField(
        max_length=8,
        unique=True,
        validators=[employee_number_validator],
        blank=True,
    )

    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=16, blank=True, validators=[phone_validator])

    skills = models.ManyToManyField(Service, related_name="employees", blank=True)

    is_active = models.BooleanField(default=True)
    hired_at = models.DateField(auto_now_add=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["pk"]
        indexes = [
            models.Index(fields=["employee_number"]),
            models.Index(fields=["last_name", "first_name"]),
        ]

    def __str__(self) -> str:
        return f"{self.employee_number} - {self.get_full_name()}"

    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def clean(self):
        super().clean()
        if self.user and getattr(self.user, "role", None) != CustomUser.Role.EMPLOYEE:
            raise ValidationError("EmployeeProfile can only be assigned to a user with EMPLOYEE role.")


class ClientProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="client_profile",
    )

    client_number = models.CharField(
        max_length=8,
        unique=True,
        validators=[client_number_validator],
        blank=True,
    )

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)

    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=16, blank=True, validators=[phone_validator])

    internal_notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["pk"]
        indexes = [
            models.Index(fields=["client_number"]),
            models.Index(fields=["last_name", "first_name"]),
        ]

    def __str__(self) -> str:
        return f"{self.client_number} - {self.get_full_name()}"

    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def clean(self):
        super().clean()
        if self.user and getattr(self.user, "role", None) != CustomUser.Role.CLIENT:
            raise ValidationError("ClientProfile can only be assigned to a user with CLIENT role.")


# =============================================================================
# AVAILABILITY (schedule + time off)
# =============================================================================

class EmployeeSchedule(models.Model):
    employee = models.OneToOneField(EmployeeProfile, on_delete=models.CASCADE, related_name="schedule")
    weekly_hours = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["pk"]

    def __str__(self) -> str:
        return f"Schedule - {self.employee.employee_number}"


class TimeOff(models.Model):
    employee = models.ForeignKey(EmployeeProfile, on_delete=models.CASCADE, related_name="time_offs")
    date_from = models.DateField()
    date_to = models.DateField()
    reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_from"]
        constraints = [
            models.CheckConstraint(check=Q(date_to__gte=models.F("date_from")), name="timeoff_date_range_valid"),
        ]
        indexes = [
            models.Index(fields=["employee", "date_from", "date_to"]),
        ]

    def __str__(self) -> str:
        return f"{self.employee.employee_number} - {self.date_from}..{self.date_to}"


# =============================================================================
# APPOINTMENTS (bookings)
# =============================================================================

class Appointment(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", _("Oczekująca")
        CONFIRMED = "CONFIRMED", _("Potwierdzona")
        COMPLETED = "COMPLETED", _("Zakończona")
        CANCELLED = "CANCELLED", _("Anulowana")

    client = models.ForeignKey(
        ClientProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="appointments",
    )
    employee = models.ForeignKey(EmployeeProfile, on_delete=models.PROTECT, related_name="appointments")
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name="appointments")

    start = models.DateTimeField(db_index=True)
    end = models.DateTimeField(db_index=True)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    internal_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["start"]
        constraints = [
            models.CheckConstraint(check=Q(end__gt=models.F("start")), name="appointment_end_after_start"),
            UniqueConstraint(fields=["employee", "start"], name="unique_employee_start"),
            # USUNIĘTO: UniqueConstraint(fields=["employee", "end"], name="unique_employee_end"),
        ]
        indexes = [
            models.Index(fields=["employee", "start"]),
            models.Index(fields=["status", "start"]),
        ]

    def __str__(self) -> str:
        return f"{self.employee.employee_number} - {self.service.name} - {self.start:%Y-%m-%d %H:%M}"

    def clean(self):
        super().clean()

        if self.end <= self.start:
            raise ValidationError({"end": "End must be after start."})

        qs = (
            Appointment.objects
            .filter(employee=self.employee)
            .exclude(pk=self.pk)
            .exclude(status=Appointment.Status.CANCELLED)  # anulowane nie blokują
        )
        if qs.filter(start__lt=self.end, end__gt=self.start).exists():
            raise ValidationError("Employee is not available in this time range.")


# =============================================================================
# SYSTEM SETTINGS (singleton)
# =============================================================================

class SystemSettings(models.Model):
    salon_name = models.CharField(max_length=255, default="Salon Kosmetyczny")
    slot_minutes = models.IntegerField(default=15, validators=[MinValueValidator(5)])
    buffer_minutes = models.IntegerField(default=0, validators=[MinValueValidator(0)])

    opening_hours = models.JSONField(default=dict, blank=True)

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True)

    def __str__(self) -> str:
        return f"System settings (updated: {self.updated_at.date()})"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_settings(cls) -> "SystemSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


# =============================================================================
# SYSTEM LOG (audit trail)
# =============================================================================

class SystemLog(models.Model):
    class Action(models.TextChoices):
        SERVICE_CREATED = "SERVICE_CREATED", "Service created"
        SERVICE_UPDATED = "SERVICE_UPDATED", "Service updated"
        SERVICE_DISABLED = "SERVICE_DISABLED", "Service disabled"

        EMPLOYEE_CREATED = "EMPLOYEE_CREATED", "Employee created"
        EMPLOYEE_UPDATED = "EMPLOYEE_UPDATED", "Employee updated"
        EMPLOYEE_DEACTIVATED = "EMPLOYEE_DEACTIVATED", "Employee deactivated"

        CLIENT_CREATED = "CLIENT_CREATED", "Client created"
        CLIENT_UPDATED = "CLIENT_UPDATED", "Client updated"
        CLIENT_DEACTIVATED = "CLIENT_DEACTIVATED", "Client deactivated"

        APPOINTMENT_CREATED = "APPOINTMENT_CREATED", "Appointment created"
        APPOINTMENT_CONFIRMED = "APPOINTMENT_CONFIRMED", "Appointment confirmed"
        APPOINTMENT_CANCELLED = "APPOINTMENT_CANCELLED", "Appointment cancelled"
        APPOINTMENT_COMPLETED = "APPOINTMENT_COMPLETED", "Appointment completed"

        AUTH_LOGIN = "AUTH_LOGIN", "User login"
        AUTH_LOGOUT = "AUTH_LOGOUT", "User logout"

        SETTINGS_UPDATED = "SETTINGS_UPDATED", "Settings updated"

    action = models.CharField(max_length=40, choices=Action.choices, db_index=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="system_logs",
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="system_logs_as_target",
    )
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["action", "timestamp"]),
        ]

    def __str__(self) -> str:
        return f"{self.timestamp} - {self.get_action_display()}"

    @classmethod
    def log(cls, *, action, performed_by=None, target_user=None):
        return cls.objects.create(
            action=action,
            performed_by=performed_by,
            target_user=target_user,
        )
