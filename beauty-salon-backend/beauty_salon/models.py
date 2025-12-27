from __future__ import annotations

import re
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.db.models import F, Q, UniqueConstraint
from django.utils.translation import gettext_lazy as _
from django.utils import timezone


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

    username = models.CharField(max_length=30, unique=True)
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
        if not self.username:
            raise ValidationError({"username": "Username is required for all users."})
        username = self.username.strip().lower()
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
        null=True,
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
        num = self.employee_number if self.employee_number else "N/A"
        return f"{num} - {self.get_full_name()}"

    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def clean(self):
        super().clean()
        if self.employee_number == "":
            self.employee_number = None
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
        null=True,
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
        num = self.client_number if self.client_number else "N/A"
        return f"{num} - {self.get_full_name()}"

    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def clean(self):
        super().clean()
        if self.client_number == "":
            self.client_number = None
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
        num = self.employee.employee_number if self.employee.employee_number else "N/A"
        return f"Schedule - {num}"


class TimeOff(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Oczekuje"
        APPROVED = "APPROVED", "Zaakceptowany"
        REJECTED = "REJECTED", "Odrzucony"
        CANCELLED = "CANCELLED", "Anulowany"


    employee = models.ForeignKey(EmployeeProfile, on_delete=models.CASCADE, related_name="timeoffs")
    date_from = models.DateField()
    date_to = models.DateField()
    reason = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="timeoff_requests",
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="timeoff_decisions",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["employee", "status", "date_from"]),
            models.Index(fields=["employee", "date_to"]),
        ]
        constraints = [
            models.CheckConstraint(check=Q(date_to__gte=F("date_from")), name="timeoff_to_gte_from"),
        ]

    def __str__(self):
        return f"{self.employee} {self.date_from}..{self.date_to} ({self.status})"

    def clean(self):
        super().clean()
        if self.date_to and self.date_from and self.date_to < self.date_from:
            raise ValidationError({"date_to": "date_to nie może być wcześniejsze niż date_from."})
        if self.employee_id and self.date_from and self.date_to and self.status == self.Status.APPROVED:
            overlap = (
                TimeOff.objects
                .filter(
                    employee_id=self.employee_id,
                    status=self.Status.APPROVED,
                    date_from__lte=self.date_to,
                    date_to__gte=self.date_from,
                )
                .exclude(pk=self.pk)
            )
            if overlap.exists():
                raise ValidationError("Ten urlop nakłada się na inny zaakceptowany urlop.")


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

    employee = models.ForeignKey(
        EmployeeProfile,
        on_delete=models.CASCADE,
        related_name="appointments",
    )

    service = models.ForeignKey(
        Service,
        on_delete=models.SET_NULL,
        null=True,
        related_name="appointments",
    )

    start = models.DateTimeField()
    end = models.DateTimeField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    internal_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    ACTIVE_STATUSES = {Status.PENDING, Status.CONFIRMED}

    class Meta:
        ordering = ["start"]
        constraints = [
            models.CheckConstraint(check=Q(end__gt=F("start")), name="appointment_end_after_start"),
            UniqueConstraint(fields=["employee", "start"], name="unique_employee_start"),
        ]
        indexes = [
            models.Index(fields=["employee", "start"]),
            models.Index(fields=["status", "start"]),
            models.Index(fields=["client", "start"]),  # NOWE
        ]

    def clean(self):
        super().clean()

        # timezone sanity (minimalnie; nie rozbijam na osobny commit)
        if self.start and timezone.is_naive(self.start):
            raise ValidationError({"start": "start must be timezone-aware"})
        if self.end and timezone.is_naive(self.end):
            raise ValidationError({"end": "end must be timezone-aware"})

        if self.end and self.start and self.end <= self.start:
            raise ValidationError({"end": "End must be after start."})

        if not self.employee_id or not self.start or not self.end:
            return

        # konflikty pracownika: tylko aktywne statusy
        # było: .exclude(status=Appointment.Status.CANCELLED)
        emp_qs = (
            Appointment.objects
            .filter(employee_id=self.employee_id, status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED])
            .exclude(pk=self.pk)
        )
        if emp_qs.filter(start__lt=self.end, end__gt=self.start).exists():
            raise ValidationError("Employee is not available in this time range.")

        if self.client_id:
            client_qs = (
                Appointment.objects
                .filter(client_id=self.client_id, status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED])
                .exclude(pk=self.pk)
            )
            if client_qs.filter(start__lt=self.end, end__gt=self.start).exists():
                raise ValidationError("Client is not available in this time range.")


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
        # SERVICES
        SERVICE_CREATED = "SERVICE_CREATED", "Service created"
        SERVICE_UPDATED = "SERVICE_UPDATED", "Service updated"
        SERVICE_DISABLED = "SERVICE_DISABLED", "Service disabled"
        SERVICE_ENABLED = "SERVICE_ENABLED", "Service enabled"  # <-- NOWE

        # EMPLOYEES
        EMPLOYEE_CREATED = "EMPLOYEE_CREATED", "Employee created"
        EMPLOYEE_UPDATED = "EMPLOYEE_UPDATED", "Employee updated"
        EMPLOYEE_DEACTIVATED = "EMPLOYEE_DEACTIVATED", "Employee deactivated"

        # CLIENTS
        CLIENT_CREATED = "CLIENT_CREATED", "Client created"
        CLIENT_UPDATED = "CLIENT_UPDATED", "Client updated"
        CLIENT_DEACTIVATED = "CLIENT_DEACTIVATED", "Client deactivated"

        # APPOINTMENTS
        APPOINTMENT_CREATED = "APPOINTMENT_CREATED", "Appointment created"
        APPOINTMENT_UPDATED = "APPOINTMENT_UPDATED", "Appointment updated"  # <-- NOWE
        APPOINTMENT_CONFIRMED = "APPOINTMENT_CONFIRMED", "Appointment confirmed"
        APPOINTMENT_CANCELLED = "APPOINTMENT_CANCELLED", "Appointment cancelled"
        APPOINTMENT_COMPLETED = "APPOINTMENT_COMPLETED", "Appointment completed"

        # TIME OFF WORKFLOW
        TIMEOFF_CREATED = "TIMEOFF_CREATED", "Time off created"
        TIMEOFF_APPROVED = "TIMEOFF_APPROVED", "Time off approved"
        TIMEOFF_REJECTED = "TIMEOFF_REJECTED", "Time off rejected"
        TIMEOFF_CANCELLED = "TIMEOFF_CANCELLED", "Time off cancelled"

        # AUTH
        AUTH_LOGIN = "AUTH_LOGIN", "User login"
        AUTH_LOGOUT = "AUTH_LOGOUT", "User logout"
        AUTH_PASSWORD_CHANGE = "AUTH_PASSWORD_CHANGE", "User password change"

        # SETTINGS
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
            models.Index(fields=["performed_by", "timestamp"]),  # NOWE
            models.Index(fields=["target_user", "timestamp"]),   # NOWE
        ]

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValidationError("SystemLog entries are append-only and cannot be modified.")
        return super().save(*args, **kwargs)

    @classmethod
    def log(cls, *, action, performed_by=None, target_user=None):
        # lekkie doprecyzowanie argumentów (bez zmiany architektury)
        return cls.objects.create(
            action=action,
            performed_by=performed_by,
            target_user=target_user,
        )