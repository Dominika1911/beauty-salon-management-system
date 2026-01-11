from __future__ import annotations

import re
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.db.models import F, Q, UniqueConstraint
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

phone_validator = RegexValidator(
    regex=r"^\+?\d{9,15}$",
    message=_("Telefon musi mieć 9–15 cyfr i może zaczynać się od znaku +."),
)

employee_number_validator = RegexValidator(
    regex=r"^\d{8}$",
    message=_("Numer pracownika musi mieć dokładnie 8 cyfr (np. 00000001)."),
)

client_number_validator = RegexValidator(
    regex=r"^\d{8}$",
    message=_("Numer klienta musi mieć dokładnie 8 cyfr (np. 00000001)."),
)

USERNAME_PATTERN = re.compile(
    r"^(?:[a-z]{2,30}\.[a-z]{2,30}|pracownik-\d{8}|admin-\d{8}|klient-\d{8})$"
)


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
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def is_employee(self) -> bool:
        return self.role == self.Role.EMPLOYEE

    @property
    def is_client(self) -> bool:
        return self.role == self.Role.CLIENT

    def clean(self) -> None:
        super().clean()

        if self.pk is not None:
            return

        if not self.username:
            raise ValidationError({"username": _("Nazwa użytkownika jest wymagana.")})

        username = self.username.strip().lower()

        if not USERNAME_PATTERN.match(username):
            raise ValidationError(
                {
                    "username": _(
                        "Nazwa użytkownika musi mieć format: 'imie.nazwisko' lub "
                        "'pracownik-00000001', 'admin-00000001', 'klient-00000001'."
                    )
                }
            )

        if self.role == self.Role.CLIENT and not username.startswith("klient-"):
            raise ValidationError(
                {"username": _("Login klienta musi zaczynać się od 'klient-'.")}
            )

        if self.role == self.Role.ADMIN and not username.startswith("admin-"):
            raise ValidationError(
                {"username": _("Login administratora musi zaczynać się od 'admin-'.")}
            )

        if self.role == self.Role.EMPLOYEE:
            ok = bool(
                re.match(r"^[a-z]{2,30}\.[a-z]{2,30}$", username)
                or re.match(r"^pracownik-\d{8}$", username)
            )
            if not ok:
                raise ValidationError(
                    {
                        "username": _(
                            "Login pracownika musi mieć format 'imie.nazwisko' lub 'pracownik-00000001'."
                        )
                    }
                )

        self.username = username


class Service(models.Model):
    name = models.CharField(max_length=255, unique=True)
    category = models.CharField(max_length=100, blank=True, db_index=True)
    description = models.TextField(blank=True)
    price = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)]
    )
    duration_minutes = models.PositiveIntegerField(validators=[MinValueValidator(5)])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["pk"]
        indexes = [models.Index(fields=["category", "name"])]
        verbose_name = _("Usługa")
        verbose_name_plural = _("Usługi")

    def __str__(self) -> str:
        return self.name

    @property
    def duration(self) -> timedelta:
        return timedelta(minutes=self.duration_minutes)


class EmployeeProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="employee_profile",
    )
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
        verbose_name = _("Profil pracownika")
        verbose_name_plural = _("Profile pracowników")

    def __str__(self) -> str:
        num = self.employee_number or "N/A"
        return f"{num} - {self.get_full_name()}"

    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def clean(self) -> None:
        super().clean()
        if self.employee_number == "":
            self.employee_number = None

        if self.user and getattr(self.user, "role", None) != CustomUser.Role.EMPLOYEE:
            raise ValidationError(
                _(
                    "Profil pracownika może być przypisany tylko do użytkownika z rolą PRACOWNIK."
                )
            )


class ClientProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
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
        verbose_name = _("Profil klienta")
        verbose_name_plural = _("Profile klientów")

    def __str__(self) -> str:
        num = self.client_number or "N/A"
        return f"{num} - {self.get_full_name()}"

    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def clean(self) -> None:
        super().clean()
        if self.client_number == "":
            self.client_number = None

        if self.user and getattr(self.user, "role", None) != CustomUser.Role.CLIENT:
            raise ValidationError(
                _(
                    "Profil klienta może być przypisany tylko do użytkownika z rolą KLIENT."
                )
            )


class EmployeeSchedule(models.Model):
    employee = models.OneToOneField(
        EmployeeProfile, on_delete=models.CASCADE, related_name="schedule"
    )
    weekly_hours = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["pk"]
        verbose_name = _("Grafik pracownika")
        verbose_name_plural = _("Grafiki pracowników")

    def __str__(self) -> str:
        num = self.employee.employee_number or "N/A"
        return f"Schedule - {num}"

    def clean(self) -> None:
        super().clean()
        system_settings = SystemSettings.get_settings()
        salon_hours = system_settings.opening_hours or {}
        day_names_pl = {
            "mon": "Poniedziałek",
            "tue": "Wtorek",
            "wed": "Środa",
            "thu": "Czwartek",
            "fri": "Piątek",
            "sat": "Sobota",
            "sun": "Niedziela",
        }

        if not self.weekly_hours:
            return

        for day, periods in self.weekly_hours.items():
            if not periods:
                continue
            pretty_day = day_names_pl.get(day, day)
            salon_day_periods = salon_hours.get(day)

            if not salon_day_periods:
                raise ValidationError(
                    {
                        f"weekly_hours": f"Nie można przypisać grafiku na dzień: {pretty_day}, ponieważ salon jest wtedy zamknięty."
                    }
                )

            for p in periods:
                emp_start = p.get("start")
                emp_end = p.get("end")
                if not emp_start or not emp_end:
                    continue

                is_within_salon_hours = False
                for s_period in salon_day_periods:
                    s_start = s_period.get("start")
                    s_end = s_period.get("end")
                    if s_start and s_end:
                        if emp_start >= s_start and emp_end <= s_end:
                            is_within_salon_hours = True
                            break

                if not is_within_salon_hours:

                    raise ValidationError(
                        {
                            f"weekly_hours": f"Godziny {emp_start}-{emp_end} w dniu: {pretty_day} wykraczają poza godziny otwarcia salonu."
                        }
                    )


class TimeOff(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", _("Oczekuje")
        APPROVED = "APPROVED", _("Zaakceptowany")
        REJECTED = "REJECTED", _("Odrzucony")
        CANCELLED = "CANCELLED", _("Anulowany")

    employee = models.ForeignKey(
        EmployeeProfile, on_delete=models.CASCADE, related_name="timeoffs"
    )
    date_from = models.DateField()
    date_to = models.DateField()
    reason = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="timeoff_requests",
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
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
            models.CheckConstraint(
                condition=Q(date_to__gte=F("date_from")), name="timeoff_to_gte_from"
            ),
        ]
        verbose_name = _("Urlop/Nieobecność")
        verbose_name_plural = _("Urlopy/Nieobecności")

    def __str__(self) -> str:
        return f"{self.employee} {self.date_from}..{self.date_to} ({self.status})"

    def clean(self) -> None:
        super().clean()
        if self.date_to and self.date_from and self.date_to < self.date_from:
            raise ValidationError(
                {"date_to": _("date_to nie może być wcześniejsze niż date_from.")}
            )

        if (
            self.employee_id
            and self.date_from
            and self.date_to
            and self.status == self.Status.APPROVED
        ):
            overlap = (
                TimeOff.objects.filter(
                    employee_id=self.employee_id,
                    status=self.Status.APPROVED,
                    date_from__lte=self.date_to,
                    date_to__gte=self.date_from,
                )
                .exclude(pk=self.pk)
                .only("id")
                .exists()
            )

            if overlap:
                raise ValidationError(
                    _("Ten urlop nakłada się na inny zaakceptowany urlop.")
                )


class Appointment(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", _("Oczekująca")
        CONFIRMED = "CONFIRMED", _("Potwierdzona")
        COMPLETED = "COMPLETED", _("Zakończona")
        CANCELLED = "CANCELLED", _("Anulowana")
        NO_SHOW = "NO_SHOW", _("Nieobecność (no-show)")

    client = models.ForeignKey(
        ClientProfile,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        related_name="appointments",
    )

    employee = models.ForeignKey(
        EmployeeProfile, on_delete=models.CASCADE, related_name="appointments"
    )
    service = models.ForeignKey(
        Service, on_delete=models.SET_NULL, null=True, related_name="appointments"
    )
    start = models.DateTimeField()
    end = models.DateTimeField()
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    internal_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["start"]
        constraints = [
            models.CheckConstraint(
                condition=Q(end__gt=F("start")),
                name="appointment_end_after_start",
            ),
            UniqueConstraint(
                fields=["employee", "start"],
                condition=Q(status__in=["PENDING", "CONFIRMED"]),
                name="unique_employee_start_active",
            ),
        ]
        indexes = [
            models.Index(fields=["employee", "start"]),
            models.Index(fields=["status", "start"]),
            models.Index(fields=["client", "start"]),
        ]
        verbose_name = _("Wizyta")
        verbose_name_plural = _("Wizyty")

    def __str__(self) -> str:
        client_name = self.client.get_full_name() if self.client else "Walk-in"
        return f"{client_name} - {self.start:%Y-%m-%d %H:%M}"

    def clean(self) -> None:
        super().clean()
        if self.start and timezone.is_naive(self.start):
            raise ValidationError(
                {"start": _("Data rozpoczęcia musi zawierać strefę czasową.")}
            )
        if self.end and timezone.is_naive(self.end):
            raise ValidationError(
                {"end": _("Data zakończenia musi zawierać strefę czasową.")}
            )
        if self.end and self.start and self.end <= self.start:
            raise ValidationError(
                {"end": _("Zakończenie wizyty musi być później niż rozpoczęcie.")}
            )

        if not self.employee_id or not self.start or not self.end:
            return

        emp_conflicts = (
            Appointment.objects.filter(
                employee_id=self.employee_id,
                status__in=[self.Status.PENDING, self.Status.CONFIRMED],
                start__lt=self.end,
                end__gt=self.start,
            )
            .exclude(pk=self.pk)
            .only("id")
            .exists()
        )

        if emp_conflicts:
            raise ValidationError(
                _("Pracownik nie jest dostępny w wybranym przedziale czasu.")
            )

        if self.client_id:
            client_conflicts = (
                Appointment.objects.filter(
                    client_id=self.client_id,
                    status__in=[self.Status.PENDING, self.Status.CONFIRMED],
                    start__lt=self.end,
                    end__gt=self.start,
                )
                .exclude(pk=self.pk)
                .only("id")
                .exists()
            )

            if client_conflicts:
                raise ValidationError(
                    _("Klient ma już inną wizytę w wybranym przedziale czasu.")
                )


class SystemSettings(models.Model):
    salon_name = models.CharField(max_length=255, default="Salon Kosmetyczny")
    slot_minutes = models.IntegerField(default=15, validators=[MinValueValidator(5)])
    buffer_minutes = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    opening_hours = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True
    )

    class Meta:
        verbose_name = _("Ustawienia systemu")
        verbose_name_plural = _("Ustawienia systemu")

    def __str__(self) -> str:
        return f"System settings (updated: {self.updated_at.date()})"

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError(_("Nie można usunąć ustawień systemu."))

    @classmethod
    def get_settings(cls) -> SystemSettings:
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class SystemLog(models.Model):
    class Action(models.TextChoices):
        SERVICE_CREATED = "SERVICE_CREATED", _("Utworzono usługę")
        SERVICE_UPDATED = "SERVICE_UPDATED", _("Zaktualizowano usługę")
        SERVICE_DISABLED = "SERVICE_DISABLED", _("Wyłączono usługę")
        SERVICE_ENABLED = "SERVICE_ENABLED", _("Włączono usługę")

        EMPLOYEE_CREATED = "EMPLOYEE_CREATED", _("Utworzono pracownika")
        EMPLOYEE_UPDATED = "EMPLOYEE_UPDATED", _("Zaktualizowano pracownika")

        CLIENT_CREATED = "CLIENT_CREATED", _("Utworzono klienta")
        CLIENT_UPDATED = "CLIENT_UPDATED", _("Zaktualizowano klienta")

        APPOINTMENT_CREATED = "APPOINTMENT_CREATED", _("Utworzono wizytę")
        APPOINTMENT_UPDATED = "APPOINTMENT_UPDATED", _("Zaktualizowano wizytę")
        APPOINTMENT_CONFIRMED = "APPOINTMENT_CONFIRMED", _("Potwierdzono wizytę")
        APPOINTMENT_CANCELLED = "APPOINTMENT_CANCELLED", _("Anulowano wizytę")
        APPOINTMENT_COMPLETED = "APPOINTMENT_COMPLETED", _("Zakończono wizytę")
        APPOINTMENT_NO_SHOW = "APPOINTMENT_NO_SHOW", _("Oznaczono wizytę jako no-show")

        TIMEOFF_CREATED = "TIMEOFF_CREATED", _("Utworzono wniosek urlopowy")
        TIMEOFF_APPROVED = "TIMEOFF_APPROVED", _("Zaakceptowano urlop")
        TIMEOFF_REJECTED = "TIMEOFF_REJECTED", _("Odrzucono urlop")
        TIMEOFF_CANCELLED = "TIMEOFF_CANCELLED", _("Anulowano wniosek urlopowy")

        AUTH_LOGIN = "AUTH_LOGIN", _("Zalogowano pomyślnie")
        AUTH_LOGOUT = "AUTH_LOGOUT", _("Wylogowano pomyślnie")
        AUTH_PASSWORD_CHANGE = "AUTH_PASSWORD_CHANGE", _("Zmieniono/zresetowano hasło")

        SETTINGS_UPDATED = "SETTINGS_UPDATED", _("Zaktualizowano ustawienia systemu")

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
            models.Index(fields=["performed_by", "timestamp"]),
        ]
        verbose_name = _("Log systemowy")
        verbose_name_plural = _("Logi systemowe")

    def __str__(self) -> str:
        return f"{self.action} - {self.timestamp:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs) -> None:
        if self.pk is not None:
            raise ValidationError(
                _("Wpisy w logu systemowym nie podlegają modyfikacji.")
            )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError(_("Nie można usuwać wpisów z logu systemowego."))

    @classmethod
    def log(cls, *, action: str, performed_by=None, target_user=None) -> "SystemLog":
        return cls.objects.create(
            action=action, performed_by=performed_by, target_user=target_user
        )
