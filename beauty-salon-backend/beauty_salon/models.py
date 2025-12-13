
from decimal import Decimal
from datetime import timedelta, datetime
from django.db import models, transaction
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db.models import JSONField, F, Q
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.core.cache import cache
from typing import Optional, Dict, Any, List, TYPE_CHECKING, cast
from django.db.models import QuerySet, ManyToManyField
from .managers import ActiveManager, AppointmentManager
from .utils import ( # Zaktualizowane importy
    phone_validator,
    calculate_vat,
    generate_invoice_number,
    generate_employee_number,
    generate_client_number
)


# ============================================================================
# BASE MODELS
# ============================================================================

class TimestampedModel(models.Model):
    created_at = models.DateTimeField(_('Utworzono'), auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(_('Zaktualizowano'), auto_now=True)

    class Meta:
        abstract = True


class SoftDeletableModel(models.Model):
    deleted_at = models.DateTimeField(_('usunięte (GDPR)'), null=True, blank=True)
    objects = models.Manager()
    active = ActiveManager()

    class Meta:
        abstract = True

    def soft_delete(self) -> None:
        self.deleted_at = timezone.now()
        self.save()

    def restore(self) -> None:
        self.deleted_at = None
        self.save()


# ============================================================================
# AUTHENTICATION & USER MANAGEMENT
# ============================================================================

class CustomUserManager(BaseUserManager['User']):
    def create_user(self, email: str, password: Optional[str] = None, **extra_fields: Any) -> 'User':
        if not email:
            raise ValueError(_('Adres email musi być podany'))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: Optional[str] = None, **extra_fields: Any) -> 'User':
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'manager')

        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser musi mieć is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser musi mieć is_superuser=True.'))

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, TimestampedModel):
    class RoleChoices(models.TextChoices):
        MANAGER = 'manager', _('Manager/Administrator')
        EMPLOYEE = 'employee', _('Pracownik')
        CLIENT = 'client', _('Klient')

    email = models.EmailField(_('adres email'), unique=True)
    first_name = models.CharField(_('imię'), max_length=150, blank=True)
    last_name = models.CharField(_('nazwisko'), max_length=150, blank=True)
    role = models.CharField(_('rola'), max_length=10, choices=RoleChoices.choices, default=RoleChoices.CLIENT)

    # Status konta
    is_active = models.BooleanField(_('aktywne'), default=True)
    is_staff = models.BooleanField(_('personel'), default=False)

    # Zabezpieczenia (blokada konta)
    failed_login_attempts = models.PositiveSmallIntegerField(_('nieudane próby logowania'), default=0)
    account_locked_until = models.DateTimeField(_('konto zablokowane do'), null=True, blank=True)
    last_login_ip = models.GenericIPAddressField(_('ostatnie IP logowania'), null=True, blank=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = _('użytkownik')
        verbose_name_plural = _('użytkownicy')
        db_table = 'auth_user'

    def __str__(self) -> str:
        return self.email

    @property
    def is_manager(self) -> bool:
        return self.role == self.RoleChoices.MANAGER

    @property
    def is_employee(self) -> bool:
        return self.role == self.RoleChoices.EMPLOYEE

    @property
    def is_client(self) -> bool:
        return self.role == self.RoleChoices.CLIENT

    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


# ============================================================================
# EMPLOYEE & CLIENT PROFILES
# ============================================================================

class Employee(SoftDeletableModel, TimestampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    number = models.CharField(
        _('numer pracownika'),
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        default=generate_employee_number,
    )
    first_name = models.CharField(_('imię'), max_length=150, blank=True)
    last_name = models.CharField(_('nazwisko'), max_length=150, blank=True)
    phone = models.CharField(_('telefon'), max_length=15, validators=[phone_validator], blank=True)
    hired_at = models.DateField(_('data zatrudnienia'), default=timezone.now)
    is_active = models.BooleanField(_('aktywny'), default=True)
    skills: ManyToManyField = models.ManyToManyField('Service',verbose_name=_('umiejętności (usługi)'),blank=True)

    #DODANE POLA
    appointments_count = models.PositiveIntegerField(_('liczba zrealizowanych wizyt'), default=0)
    average_rating = models.DecimalField(_('średnia ocena'), max_digits=3, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        verbose_name = _('pracownik')
        verbose_name_plural = _('pracownicy')
        ordering = ['last_name', 'first_name']

    def __str__(self) -> str:
        return self.get_full_name()

    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class Client(SoftDeletableModel, TimestampedModel):
    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='client_profile')
    number = models.CharField(
        _('numer klienta'),
        max_length=20,
        unique=True,
        null=True,  #pozwala zapisać klienta bez numeru
        blank=True, #pozwala pominąć numer w formularzach/adminie
        default = generate_client_number,
    )
    first_name = models.CharField(_('imię'), max_length=150)
    last_name = models.CharField(_('nazwisko'), max_length=150)
    email = models.EmailField(_('adres email'), unique=True, null=True, blank=True)
    phone = models.CharField(_('telefon'), max_length=15, validators=[phone_validator], unique=True, null=True,
                             blank=True)

    # CRM Metrics
    visits_count = models.PositiveIntegerField(_('liczba zrealizowanych wizyt'), default=0)
    total_spent_amount = models.DecimalField(_('wydana kwota (PLN)'), max_digits=12, decimal_places=2,
                                             default=Decimal('0.00'))

    # Marketing / GDPR
    marketing_consent = models.BooleanField(_('zgoda marketingowa'), default=False)

    class ContactPreference(models.TextChoices):
        EMAIL = 'email', _('Email')
        SMS = 'sms', _('SMS')
        PHONE = 'phone', _('Telefon')
        NONE = 'none', _('Brak')

    preferred_contact = models.CharField(
        _('preferowany kontakt'), max_length=10, choices=ContactPreference.choices, default=ContactPreference.EMAIL
    )

    # DODANE POLE
    internal_notes = models.TextField(_('notatki wewnętrzne'), blank=True)

    class Meta:
        verbose_name = _('klient')
        verbose_name_plural = _('klienci')
        ordering = ['last_name', 'first_name']

    def __str__(self) -> str:
        return f"{self.get_full_name()} ({self.number or self.email or self.phone})"

    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


# ============================================================================
# SERVICE & PRICING
# ============================================================================

class Service(SoftDeletableModel, TimestampedModel):
    name = models.CharField(_('nazwa usługi'), max_length=255)
    description = models.TextField(_('opis'), blank=True)

    # Pricing
    price = models.DecimalField(_('cena podstawowa (PLN)'), max_digits=10, decimal_places=2)
    duration = models.DurationField(_('czas trwania'))

    # Categorization
    category = models.CharField(_('kategoria'), max_length=100, blank=True, db_index=True)

    # Status
    is_published = models.BooleanField(_('opublikowana (widoczna)'), default=True)

    # Promo (JSONField)
    promotion = models.JSONField(_('promocja'), default=dict, blank=True)

    # DODANE POLA
    image_url = models.URLField(_('URL obrazka'), blank=True)
    reservations_count = models.PositiveIntegerField(_('liczba rezerwacji'), default=0)

    class Meta:
        verbose_name = _('usługa')
        verbose_name_plural = _('usługi')
        ordering = ['name']

    def __str__(self) -> str:
        return self.name

    def get_price_with_promotion(self) -> Decimal:
        """Oblicza cenę po zastosowaniu promocji."""
        if self.promotion and self.promotion.get('active', False):
            discount = self.promotion.get('discount_percent', 0)
            if discount > 0:
                return self.price * (1 - Decimal(discount) / Decimal('100.00'))
        return self.price


# ============================================================================
# SCHEDULE & TIME OFF
# ============================================================================

class Schedule(TimestampedModel):
    class Status(models.TextChoices):
        ACTIVE = 'active', _('Aktywny')
        INACTIVE = 'inactive', _('Nieaktywny')

    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, verbose_name=_('pracownik'),
                                    related_name='schedule')
    status = models.CharField(_('status'), max_length=10, choices=Status.choices, default=Status.ACTIVE)

    # JSONField przechowujący dni i godziny pracy
    availability_periods = models.JSONField(_('okresy dostępności'), default=list, blank=True)

    # JSONField przechowujący przerwy
    breaks = models.JSONField(_('przerwy'), default=list, blank=True)

    class Meta:
        verbose_name = _('grafik pracy')
        verbose_name_plural = _('grafiki pracy')

    def __str__(self) -> str:
        return f"Grafik dla {self.employee.get_full_name()}"


class TimeOff(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', _('Oczekujący')
        APPROVED = 'approved', _('Zatwierdzony')
        REJECTED = 'rejected', _('Odrzucony')

    class Type(models.TextChoices):
        VACATION = 'vacation', _('Urlop wypoczynkowy')
        SICK_LEAVE = 'sick_leave', _('Zwolnienie chorobowe')
        OTHER = 'other', _('Inny')

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, verbose_name=_('pracownik'),
                                 related_name='time_offs')
    date_from = models.DateField(_('data od'))
    date_to = models.DateField(_('data do'))
    status = models.CharField(_('status'), max_length=10, choices=Status.choices, default=Status.PENDING)
    type = models.CharField(_('typ nieobecności'), max_length=20, choices=Type.choices, default=Type.VACATION)
    reason = models.TextField(_('powód/uwagi'), blank=True)

    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_time_offs',
        verbose_name=_('zatwierdzone przez')
    )
    approved_at = models.DateTimeField(_('zatwierdzone o'), null=True, blank=True)

    class Meta:
        verbose_name = _('nieobecność')
        verbose_name_plural = _('nieobecności')
        ordering = ['-date_from']


# ============================================================================
# APPOINTMENTS
# ============================================================================

class Appointment(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', _('Oczekująca (do potwierdzenia)')
        CONFIRMED = 'confirmed', _('Potwierdzona')
        IN_PROGRESS = 'in_progress', _('W trakcie')
        COMPLETED = 'completed', _('Zakończona')
        CANCELLED = 'cancelled', _('Anulowana')
        NO_SHOW = 'no_show', _('Nieobecność (No-show)')

    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_('klient'),
                               related_name='appointments')
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, verbose_name=_('pracownik'),
                                 related_name='appointments')
    service = models.ForeignKey(Service, on_delete=models.PROTECT, verbose_name=_('usługa'),
                                related_name='appointments')

    # Czas
    start = models.DateTimeField(_('czas rozpoczęcia'), db_index=True)
    end = models.DateTimeField(_('czas zakończenia'), db_index=True)

    # Status
    status = models.CharField(_('status'), max_length=15, choices=Status.choices, default=Status.PENDING, db_index=True)

    # Inne
    internal_notes = models.TextField(_('uwagi wewnętrzne'), blank=True)
    booking_channel = models.CharField(_('kanał rezerwacji'), max_length=50, blank=True)

    # DODANE POLA
    client_notes = models.TextField(_('uwagi klienta'), blank=True)
    cancelled_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cancelled_appointments',
        verbose_name=_('anulowane przez')
    )
    cancelled_at = models.DateTimeField(_('anulowano o'), null=True, blank=True)
    cancellation_reason = models.TextField(_('powód anulacji'), blank=True)
    reminder_sent = models.BooleanField(_('przypomnienie wysłane'), default=False, db_index=True)
    reminder_sent_at = models.DateTimeField(_('przypomnienie wysłane o'), null=True, blank=True)

    # Custom Manager
    objects = AppointmentManager()

    class Meta:
        verbose_name = _('wizyta')
        verbose_name_plural = _('wizyty')
        ordering = ['id']

    def __str__(self) -> str:
        return f"Wizyta {self.id} - {self.service.name} ({self.start.strftime('%Y-%m-%d %H:%M')})"

    def timespan(self) -> str:
        """Metoda pomocnicza dla admin - zwraca czas trwania"""
        if self.start and self.end:
            duration = self.end - self.start
            return f"{duration.total_seconds() / 60:.0f} min"
        return "-"


class Note(TimestampedModel):
    """Notatki dołączone do wizyty lub do profilu klienta."""
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, null=True, blank=True, related_name='notes')
    client = models.ForeignKey(Client, on_delete=models.CASCADE, null=True, blank=True, related_name='notes')
    content = models.TextField(_('treść notatki'))
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name=_('autor'))
    visible_for_client = models.BooleanField(_('widoczna dla klienta'), default=False)

    class Meta:
        verbose_name = _('notatka')
        verbose_name_plural = _('notatki')
        ordering = ['-created_at']


# ============================================================================
# FINANCIALS
# ============================================================================

class Payment(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', _('Oczekująca')
        PAID = 'paid', _('Opłacona')
        CANCELLED = 'cancelled', _('Anulowana')
        REFUNDED = 'refunded', _('Zwrócona')
        DEPOSIT = 'deposit', _('Zaliczka')
        FORFEITED = 'forfeited', _('Utracona (kara)')

    class Method(models.TextChoices):
        CASH = 'cash', _('Gotówka')
        CARD = 'card', _('Karta')
        TRANSFER = 'transfer', _('Przelew')
        OTHER = 'other', _('Inna')

    class Type(models.TextChoices):
        FULL = 'full', _('Pełna płatność')
        DEPOSIT = 'deposit', _('Zaliczka')
        TIP = 'tip', _('Napiwek')

    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='payments')
    amount = models.DecimalField(_('kwota (PLN)'), max_digits=12, decimal_places=2)
    status = models.CharField(_('status'), max_length=15, choices=Status.choices, default=Status.PENDING)
    method = models.CharField(_('metoda płatności'), max_length=10, choices=Method.choices, default=Method.CARD)
    type = models.CharField(_('typ płatności'), max_length=10, choices=Type.choices, default=Type.FULL)
    paid_at = models.DateTimeField(_('data płatności'), null=True, blank=True)
    reference = models.CharField(_('numer referencyjny'), max_length=100, blank=True)

    class Meta:
        verbose_name = _('płatność')
        verbose_name_plural = _('płatności')
        ordering = ['-paid_at']

    def __str__(self) -> str:
        return f"Płatność {self.id} - {self.amount} PLN ({self.get_status_display()})"


class Invoice(TimestampedModel):
    """Faktura/Paragon dla klienta."""

    class Status(models.TextChoices):
        DRAFT = 'draft', _('Szkic')
        FINAL = 'final', _('Ostateczna')
        PAID = 'paid', _('Opłacona')
        CANCELLED = 'cancelled', _('Anulowana')

    number = models.CharField(_('numer faktury'), max_length=50, unique=True, default=generate_invoice_number)
    appointment = models.ForeignKey(Appointment, on_delete=models.PROTECT, verbose_name=_('wizyta'),
                                    related_name='invoices')
    client = models.ForeignKey(Client, on_delete=models.PROTECT, null=True, blank=True, verbose_name=_('klient'))
    client_name = models.CharField(_('nazwa klienta'), max_length=255)
    client_tax_id = models.CharField(_('NIP klienta'), max_length=20, blank=True)

    # Kwoty
    net_amount = models.DecimalField(_('kwota netto'), max_digits=12, decimal_places=2)
    vat_rate = models.DecimalField(_('stawka VAT (%)'), max_digits=4, decimal_places=2)
    vat_amount = models.DecimalField(_('kwota VAT'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    gross_amount = models.DecimalField(_('kwota brutto'), max_digits=12, decimal_places=2, default=Decimal('0.00'))

    # Daty
    issue_date = models.DateField(_('data wystawienia'), default=timezone.now)
    sale_date = models.DateField(_('data sprzedaży'), null=True, blank=True)
    due_date = models.DateField(_('termin płatności'), null=True, blank=True)
    paid_date = models.DateField(_('data zapłaty'), null=True, blank=True)

    # Status i plik
    status = models.CharField(_('status'), max_length=10, choices=Status.choices, default=Status.DRAFT)
    is_paid = models.BooleanField(_('opłacona'), default=False)
    pdf_file = models.FileField(_('plik PDF'), upload_to='invoices/%Y/%m/', blank=True, null=True)

    class Meta:
        verbose_name = _('faktura')
        verbose_name_plural = _('faktury')
        ordering = ['-issue_date']

    def __str__(self) -> str:
        return self.number


# ============================================================================
# MEDIA & REPORTING
# ============================================================================

class MediaAsset(TimestampedModel):
    """Zasoby multimedialne (np. zdjęcia przed/po)."""

    class Type(models.TextChoices):
        BEFORE = 'before', _('Przed')
        AFTER = 'after', _('Po')
        OTHER = 'other', _('Inny')

    name = models.CharField(_('nazwa'), max_length=255)
    file_name = models.CharField(_('nazwa pliku'), max_length=255, blank=True)
    file = models.FileField(_('plik'), upload_to='media_assets/%Y/%m/%d/')
    file_url = models.URLField(_('URL pliku'), blank=True)
    file_size = models.PositiveIntegerField(_('rozmiar pliku (bajty)'), null=True, blank=True)
    size_bytes = models.PositiveIntegerField(_('rozmiar (bajty)'), null=True, blank=True)
    mime_type = models.CharField(_('typ MIME'), max_length=100, blank=True)
    type = models.CharField(_('typ'), max_length=10, choices=Type.choices, default=Type.OTHER)
    description = models.TextField(_('opis'), blank=True)
    is_private = models.BooleanField(_('prywatny (tylko personel)'), default=True)
    is_active = models.BooleanField(_('aktywny'), default=True)

    # Powiązania
    employee = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='media_assets', verbose_name=_('pracownik'))
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='media_assets')
    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='media_assets')

    class Meta:
        verbose_name = _('zasób multimedialny')
        verbose_name_plural = _('zasoby multimedialne')

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.file and not self.file_name:
            self.file_name = self.file.name
        if self.file and not self.file_size and hasattr(self.file, 'size'):
            self.file_size = self.file.size
            self.size_bytes = self.file.size
        super().save(*args, **kwargs)


class ReportPDF(TimestampedModel):
    """Wygenerowane pliki PDF raportów."""

    class Type(models.TextChoices):
        MONTHLY = 'monthly', _('Miesięczny')
        ANNUAL = 'annual', _('Roczny')
        CUSTOM = 'custom', _('Niestandardowy')
        FINANCIAL = 'financial', _('Finansowy')

    type = models.CharField(_('typ raportu'), max_length=10, choices=Type.choices)
    title = models.CharField(_('tytuł raportu'), max_length=255, blank=True)
    date_from = models.DateField(_('data od'))
    date_to = models.DateField(_('data do'))
    data_od = models.DateField(_('data od (alias)'), null=True, blank=True)  # Alias
    data_do = models.DateField(_('data do (alias)'), null=True, blank=True)  # Alias
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name=_('wygenerowany przez'))
    file = models.FileField(_('plik PDF'), upload_to='reports/%Y/%m/')
    file_path = models.CharField(_('ścieżka do pliku'), max_length=500, blank=True)
    file_size = models.PositiveIntegerField(_('rozmiar pliku'), null=True, blank=True)
    parameters = models.JSONField(_('parametry'), default=dict, blank=True)
    notes = models.TextField(_('uwagi'), blank=True)

    class Meta:
        verbose_name = _('raport PDF')
        verbose_name_plural = _('raporty PDF')
        ordering = ['-created_at']

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.date_from and not self.data_od:
            self.data_od = self.date_from
        if self.date_to and not self.data_do:
            self.data_do = self.date_to
        if self.file and not self.file_path:
            self.file_path = self.file.name
        if self.file and not self.file_size and hasattr(self.file, 'size'):
            self.file_size = self.file.size
        super().save(*args, **kwargs)


# ============================================================================
# SYSTEM & AUDIT
# ============================================================================

class SystemSettings(TimestampedModel):
    """Globalne ustawienia systemu (model Singleton)."""

    salon_name = models.CharField(_('nazwa salonu'), max_length=255, default=_('Mój Salon Piękności'))
    address = models.CharField(_('adres'), max_length=255, blank=True)
    phone = models.CharField(_('telefon'), max_length=15, blank=True)
    contact_email = models.EmailField(_('email kontaktowy'), blank=True)

    slot_minutes = models.PositiveSmallIntegerField(_('minimalny czas slotu (min)'), default=30)
    buffer_minutes = models.PositiveSmallIntegerField(_('czas buforu między wizytami (min)'), default=15)
    default_vat_rate = models.DecimalField(_('domyślna stawka VAT (%)'), max_digits=4, decimal_places=2,
                                           default=Decimal('23.00'))

    # Polityka zaliczek/anulacji
    deposit_policy = JSONField(_('polityka zaliczek/anulacji'), default=dict, blank=True)

    # Godziny otwarcia (JSONField)
    opening_hours = JSONField(_('godziny otwarcia'), default=dict, blank=True)

    # Inne ustawienia
    is_online_booking_enabled = models.BooleanField(_('rezerwacja online włączona'), default=True)
    maintenance_mode = models.BooleanField(_('tryb konserwacji'), default=False)
    maintenance_message = models.TextField(_('komunikat konserwacji'), blank=True)

    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_settings',
        verbose_name=_('ostatnio zmodyfikowane przez')
    )

    class Meta:
        verbose_name = _('ustawienia systemowe')
        verbose_name_plural = _('ustawienia systemowe')

    _cached_settings: Optional['SystemSettings'] = None  # Dodano to jako atrybut klasy

    @classmethod
    def load(cls) -> 'SystemSettings':
        """Ładuje jedyny obiekt SystemSettings."""
        if cls._cached_settings is None:
            cached_settings = cache.get('system_settings_cache')
            if cached_settings:
                cls._cached_settings = cached_settings
            else:
                obj, created = cls.objects.get_or_create(pk=1)
                cls._cached_settings = obj
                cache.set('system_settings_cache', obj)
        return cls._cached_settings

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Zapisuje i aktualizuje cache."""
        self.pk = 1
        super().save(*args, **kwargs)
        cache.set('system_settings_cache', self)
        SystemSettings._cached_settings = self


class AuditLog(TimestampedModel):
    """Rejestr kluczowych działań w systemie."""

    class Level(models.TextChoices):
        INFO = 'info', _('Informacja')
        WARNING = 'warning', _('Ostrzeżenie')
        ERROR = 'error', _('Błąd')

    class Type(models.TextChoices):
        USER_ACTION = 'user.action', _('Akcja Użytkownika')
        SYSTEM_OPERATION = 'system.operation', _('Operacja Systemowa')
        APPOINTMENT_CHANGE = 'appointment.change', _('Zmiana Wizyty')
        PAYMENT_CHANGE = 'payment.change', _('Zmiana Płatności')
        PAYMENT_DEPOSIT_FORFEITED = 'payment.deposit_forfeited', _('Utrata Zaliczki')

    type = models.CharField(_('typ zdarzenia'), max_length=30, choices=Type.choices, db_index=True)
    level = models.CharField(_('poziom'), max_length=10, choices=Level.choices, default=Level.INFO)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_('użytkownik'))
    message = models.TextField(_('wiadomość/opis'))
    data = JSONField(_('szczegóły (JSON)'), default=dict, blank=True)
    adres_ip = models.GenericIPAddressField(_('adres IP'), null=True, blank=True)
    user_agent = models.CharField(_('user agent'), max_length=255, blank=True)
    entity_type = models.CharField(_('typ encji'), max_length=50, blank=True)
    entity_id = models.CharField(_('ID encji'), max_length=50, blank=True)
    metadata = models.JSONField(_('metadata'), default=dict, blank=True)

    objects = models.Manager()

    class Meta:
        verbose_name = _('log audytu')
        verbose_name_plural = _('logi audytu')
        ordering = ['-created_at']


class StatsSnapshot(TimestampedModel):
    """Zapisane statystyki (np. miesięczne, roczne)."""

    class Period(models.TextChoices):
        DAILY = 'daily', _('Dzienne')
        WEEKLY = 'weekly', _('Tygodniowe')
        MONTHLY = 'monthly', _('Miesięczne')
        ANNUAL = 'annual', _('Roczne')

    period = models.CharField(_('okres'), max_length=20, choices=Period.choices)
    total_visits = models.PositiveIntegerField(_('liczba wizyt (total)'), default=0)
    date_from = models.DateField(_('data od'), null=True, blank=True)
    date_to = models.DateField(_('data do'), null=True, blank=True)
    completed_visits = models.PositiveIntegerField(_('liczba wizyt zrealizowanych'), default=0)
    cancellations = models.PositiveIntegerField(_('liczba anulacji'), default=0)
    no_shows = models.PositiveIntegerField(_('liczba no-show'), default=0)
    revenue_total = models.DecimalField(_('przychód total'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    revenue_deposits = models.DecimalField(_('przychód z zaliczek'), max_digits=12, decimal_places=2,
                                           default=Decimal('0.00'))
    new_clients = models.PositiveIntegerField(_('liczba nowych klientów'), default=0)
    returning_clients = models.PositiveIntegerField(_('liczba powracających klientów'), default=0)
    employees_occupancy_avg = models.DecimalField(_('średnie obłożenie pracowników %'), max_digits=5, decimal_places=2,
                                                  default=Decimal('0.00'))
    extra_metrics = models.JSONField(_('dodatkowe metryki'), default=dict, blank=True)

    class Meta:
        verbose_name = _('migawka statystyk')
        verbose_name_plural = _('migawki statystyk')
        ordering = ['-date_from', '-period']


# ============================================================================
# NOTIFICATIONS
# ============================================================================

class Notification(TimestampedModel):
    """Powiadomienia wysyłane do klientów (np. przypomnienia o wizytach, promocje)."""

    class Type(models.TextChoices):
        REMINDER = 'reminder', _('Przypomnienie o wizycie')
        CANCELLATION = 'cancellation', _('Anulowanie wizyty')
        PROMOTION = 'promotion', _('Promocja')
        CUSTOM = 'custom', _('Wiadomość niestandardowa')

    class Channel(models.TextChoices):
        EMAIL = 'email', _('E-mail')
        SMS = 'sms', _('SMS')
        PUSH = 'push', _('Powiadomienie push')

    class Status(models.TextChoices):
        PENDING = 'pending', _('Oczekujące')
        SENT = 'sent', _('Wysłane')
        FAILED = 'failed', _('Nieudane')

    client = models.ForeignKey(
        'Client',
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name=_('Klient')
    )
    appointment = models.ForeignKey(
        'Appointment',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
        verbose_name=_('Wizyta')
    )

    type = models.CharField(_('Typ'), max_length=20, choices=Type.choices, default=Type.REMINDER)
    channel = models.CharField(_('Kanał'), max_length=20, choices=Channel.choices, default=Channel.EMAIL)
    status = models.CharField(_('Status'), max_length=20, choices=Status.choices, default=Status.PENDING)

    subject = models.CharField(_('Temat'), max_length=200, blank=True)
    content = models.TextField(_('Treść'))

    scheduled_at = models.DateTimeField(_('Planowana wysyłka'), default=timezone.now)
    sent_at = models.DateTimeField(_('Wysłano'), null=True, blank=True)
    error_message = models.TextField(_('Komunikat błędu'), blank=True)
    attempts_count = models.PositiveIntegerField(_('Liczba prób wysyłki'), default=0)

    class Meta:
        verbose_name = _('Powiadomienie')
        verbose_name_plural = _('Powiadomienia')
        ordering = ['-scheduled_at']

    def __str__(self) -> str:
        return f"{self.client} → {self.get_type_display()} ({self.get_channel_display()})"