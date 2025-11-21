# salon/models.py

from decimal import Decimal
from datetime import timedelta, datetime
from django.db import models, transaction
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db.models import JSONField, F, Q
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.core.cache import cache

from .managers import ActiveManager, AppointmentManager
from .utils import phone_validator, calculate_vat, generate_invoice_number


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

    def soft_delete(self): self.deleted_at = timezone.now(); self.save()

    def restore(self): self.deleted_at = None; self.save()


# ============================================================================
# USER MANAGEMENT
# ============================================================================

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email: raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True);
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.RoleChoices.MANAGER)
        if extra_fields.get('is_superuser') is not True: raise ValueError('Superuser must have is_superuser=True.')
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, TimestampedModel):
    class RoleChoices(models.TextChoices):
        MANAGER = 'manager', _('Administrator')
        EMPLOYEE = 'employee', _('Pracownik')
        CLIENT = 'client', _('Klient')

    email = models.EmailField(_('email'), unique=True, db_index=True)
    role = models.CharField(_('rola'), max_length=20, choices=RoleChoices.choices, default=RoleChoices.CLIENT,
                            db_index=True)
    is_staff = models.BooleanField(_('status personelu'), default=False)
    is_active = models.BooleanField(_('aktywny'), default=True)
    last_login_ip = models.GenericIPAddressField(_('ostatnie logowanie IP'), null=True, blank=True)
    failed_login_attempts = models.PositiveIntegerField(_('nieudane próby logowania'), default=0)
    account_locked_until = models.DateTimeField(_('konto zablokowane do'), null=True, blank=True)

    objects = UserManager()
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'
        verbose_name = _('użytkownik');
        verbose_name_plural = _('użytkownicy')
        indexes = [models.Index(fields=['email', 'is_active']), models.Index(fields=['role'])]

    def __str__(self): return self.email

    def is_manager(self): return self.role == self.RoleChoices.MANAGER

    def is_salon_employee(self): return self.role == self.RoleChoices.EMPLOYEE

    def is_salon_client(self): return self.role == self.RoleChoices.CLIENT


# ============================================================================
# SERVICES
# ============================================================================

class Service(TimestampedModel):
    name = models.CharField(_('nazwa'), max_length=200, db_index=True)
    category = models.CharField(_('kategoria'), max_length=100, db_index=True)
    description = models.TextField(_('opis'), blank=True)
    price = models.DecimalField(_('cena'), max_digits=10, decimal_places=2)
    duration = models.DurationField(_('czas trwania'))
    image_url = models.CharField(_('zdjęcie URL'), max_length=500, blank=True)
    is_published = models.BooleanField(_('publikowana'), default=True, db_index=True)
    promotion = models.JSONField(_('promocja'), null=True, blank=True)
    reservations_count = models.PositiveIntegerField(_('liczba rezerwacji'), default=0)

    class Meta:
        db_table = 'uslugi';
        verbose_name = _('usługa');
        verbose_name_plural = _('usługi')
        ordering = ['category', 'name']

    def __str__(self): return self.name

    def clean(self): pass

    def get_price_with_promotion(self):
        if not self.promotion or not self.promotion.get('active'):
            return self.price
        discount_percent = self.promotion.get('discount_percent', 0)
        discounted = self.price * (1 - Decimal(str(discount_percent)) / 100)
        return discounted.quantize(Decimal('0.01'))


# ============================================================================
# EMPLOYEES
# ============================================================================

class Employee(TimestampedModel):
    number = models.CharField(_('numer pracownika'), max_length=20, unique=True, db_index=True)
    first_name = models.CharField(_('imię'), max_length=100)
    last_name = models.CharField(_('nazwisko'), max_length=100)

    user = models.OneToOneField(User, on_delete=models.CASCADE, limit_choices_to={'role': User.RoleChoices.EMPLOYEE},
                                related_name='employee', verbose_name=_('Konto użytkownika'))
    skills = models.ManyToManyField(Service, related_name='employees', blank=True, verbose_name=_('Kompetencje'))
    phone = models.CharField(_('telefon'), max_length=20, blank=True, validators=[phone_validator])

    hired_at = models.DateField(_('data zatrudnienia'), null=True, blank=True)
    average_rating = models.DecimalField(_('średnia ocena'), max_digits=3, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(_('aktywny'), default=True, db_index=True)
    appointments_count = models.PositiveIntegerField(_('liczba wizyt'), default=0)

    class Meta:
        db_table = 'pracownicy';
        verbose_name = _('pracownik');
        verbose_name_plural = _('pracownicy')
        ordering = ['last_name', 'first_name']

    def __str__(self): return f"{self.number} - {self.first_name} {self.last_name}"

    def get_full_name(self): return f"{self.first_name} {self.last_name}"

    # USUNIĘTO: save() - obsługiwane przez signals.py


# ============================================================================
# SCHEDULE (Schedule + TimeOff)
# ============================================================================

class Schedule(TimestampedModel):
    class Status(models.TextChoices):
        ACTIVE = 'active', _('Aktywny');
        PENDING = 'pending', _('Oczekujący na zatwierdzenie')

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='schedules',
                                 verbose_name=_('Pracownik'))
    availability_periods = models.JSONField(_('okresy dostępności'), default=list)
    breaks = models.JSONField(_('przerwy'), default=list)
    status = models.CharField(_('status'), max_length=20, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        db_table = 'grafiki';
        verbose_name = _('grafik');
        verbose_name_plural = _('grafiki')
        indexes = [models.Index(fields=['employee', 'status'])]

    def clean(self): pass

    def is_available_on_date(self, date): return True


class TimeOff(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', _('Oczekujący');
        APPROVED = 'approved', _('Zatwierdzony');
        REJECTED = 'rejected', _('Odrzucony')

    class Type(models.TextChoices):
        VACATION = 'vacation', _('Urlop')
        SICK = 'sick', _('Choroba')
        PERSONAL = 'personal', _('Osobiste/Inne')

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='time_offs',
                                 verbose_name=_('Pracownik'))
    date_from = models.DateField(_('data od'))
    date_to = models.DateField(_('data do'))
    status = models.CharField(_('status'), max_length=20, choices=Status.choices, default=Status.PENDING)
    reason = models.TextField(_('powód'), blank=True)

    type = models.CharField(_('typ'), max_length=20, choices=Type.choices, default=Type.VACATION)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='approved_time_offs', verbose_name=_('Zatwierdzone przez'))
    approved_at = models.DateTimeField(_('data zatwierdzenia'), null=True, blank=True)

    class Meta:
        db_table = 'urlopy';
        verbose_name = _('urlop/niedostępność');
        verbose_name_plural = _('urlopy/niedostępności')
        constraints = [models.CheckConstraint(check=Q(date_to__gte=F('date_from')), name='timeoff_valid_dates')]


# ============================================================================
# CLIENTS
# ============================================================================

class Client(SoftDeletableModel, TimestampedModel):
    class ContactPreference(models.TextChoices):
        EMAIL = 'email', _('Email')
        PHONE = 'telefon', _('Telefon')
        SMS = 'sms', _('SMS')

    first_name = models.CharField(_('imię'), max_length=100)
    last_name = models.CharField(_('nazwisko'), max_length=100)
    email = models.EmailField(_('email'), db_index=True)
    phone = models.CharField(_('telefon'), max_length=20, blank=True, validators=[phone_validator])
    number = models.CharField(_('numer klienta'), max_length=20, unique=True, db_index=True)

    user = models.OneToOneField(User, on_delete=models.SET_NULL, limit_choices_to={'role': User.RoleChoices.CLIENT},
                                null=True, blank=True, related_name='client', verbose_name=_('Konto użytkownika'))

    total_spent_amount = models.DecimalField(_('łączna kwota wydana'), max_digits=12, decimal_places=2,
                                             default=Decimal('0.00'))
    marketing_consent = models.BooleanField(_('zgoda marketingowa'), default=False)
    preferred_contact = models.CharField(_('preferowany kontakt'), max_length=20, choices=ContactPreference.choices,
                                         default=ContactPreference.EMAIL)
    visits_count = models.PositiveIntegerField(_('liczba wizyt'), default=0)
    internal_notes = models.TextField(_('notatki wewnętrzne'), blank=True)

    class Meta:
        db_table = 'klienci';
        verbose_name = _('klient');
        verbose_name_plural = _('klienci')
        ordering = ['last_name', 'first_name']
        base_manager_name = 'objects';
        default_manager_name = 'active'

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"

    def soft_delete(self):
        with transaction.atomic():
            self.first_name = "USUNIĘTY";
            self.last_name = "USUNIĘTY"
            self.email = f"deleted_{self.id}@deleted.local";
            self.phone = "";
            self.internal_notes = ""
            if hasattr(self, 'appointments'): self.appointments.all().update(client_notes="")
            if hasattr(self, 'notifications'): self.notifications.all().delete()
            super().soft_delete()

    # USUNIĘTO: save() - obsługiwane przez signals.py


# ============================================================================
# APPOINTMENTS
# ============================================================================

class Appointment(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', _('Oczekująca')
        CONFIRMED = 'confirmed', _('Potwierdzona')
        IN_PROGRESS = 'in_progress', _('W trakcie')
        COMPLETED = 'completed', _('Zrealizowana')
        CANCELLED = 'cancelled', _('Odwołana')
        NO_SHOW = 'no_show', _('Nieobecność (No-show)')

    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='appointments', verbose_name=_('Klient'))
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='appointments',
                                 verbose_name=_('Pracownik'))
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name='appointments',
                                verbose_name=_('Usługa'))

    status = models.CharField(_('status'), max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    start = models.DateTimeField(_('termin start'), db_index=True)
    end = models.DateTimeField(_('termin koniec'))

    booking_channel = models.CharField(_('kanał rezerwacji'), max_length=20, default='web')
    client_notes = models.TextField(_('notatki klienta'), blank=True)
    internal_notes = models.TextField(_('notatki wewnętrzne'), blank=True)
    cancelled_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='cancelled_appointments',
                                     verbose_name=_('Anulowane przez'))
    cancelled_at = models.DateTimeField(_('data anulowania'), null=True, blank=True)
    cancellation_reason = models.TextField(_('powód anulowania'), blank=True)
    reminder_sent = models.BooleanField(_('przypomnienie wysłane'), default=False)
    reminder_sent_at = models.DateTimeField(null=True, blank=True)

    objects = AppointmentManager()

    class Meta:
        db_table = 'wizyty';
        verbose_name = _('wizyta');
        verbose_name_plural = _('wizyty')
        ordering = ['-start']

    @property
    def timespan(self):
        if self.start and self.end:
            return f"{self.start.strftime('%H:%M')} - {self.end.strftime('%H:%M')}"
        return ""

    def save(self, *args, **kwargs):
        with transaction.atomic():
            if self.pk: Appointment.objects.select_for_update().filter(pk=self.pk).first()
            if self.service and self.start and not self.end: self.end = self.start + self.service.duration
            self.full_clean()
            super().save(*args, **kwargs)

    def clean(self):
        pass


# ============================================================================
# NOTES & MEDIA
# ============================================================================

class Note(TimestampedModel):
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name='notes',
                                    verbose_name=_('Wizyta'))
    content = models.TextField(_('treść'))
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='notes',
                               verbose_name=_('Autor'))
    visible_for_client = models.BooleanField(_('widoczna dla klienta'), default=False)

    class Meta:
        db_table = 'notatki';
        verbose_name = _('notatka');
        verbose_name_plural = _('notatki')


class MediaAsset(TimestampedModel):
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='media_assets',
                                 verbose_name=_('Pracownik'))
    file_url = models.CharField(_('ścieżka URL'), max_length=500)
    type = models.CharField(_('typ'), max_length=20, default='portfolio')
    file_name = models.CharField(_('nazwa pliku'), max_length=255, blank=True)
    size_bytes = models.PositiveIntegerField(_('rozmiar (B)'), null=True, blank=True)
    is_active = models.BooleanField(_('aktywny'), default=True, db_index=True)
    description = models.TextField(_('opis'), blank=True)
    mime_type = models.CharField(_('MIME type'), max_length=100, blank=True)

    class Meta:
        db_table = 'materialy';
        verbose_name = _('materiał');
        verbose_name_plural = _('materiały')


# ============================================================================
# BILLING: PAYMENTS & INVOICES
# ============================================================================

class Payment(TimestampedModel):
    class Status(models.TextChoices):
        PAID = 'paid', _('Zapłacona');
        DEPOSIT = 'deposit', _('Zaliczka');
        PENDING = 'pending', _('Oczekująca');

    appointment = models.ForeignKey(Appointment, on_delete=models.PROTECT, related_name='payments', null=True,
                                    blank=True, verbose_name=_('Wizyta'))
    amount = models.DecimalField(_('kwota'), max_digits=10, decimal_places=2)
    status = models.CharField(_('status'), max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    paid_at = models.DateTimeField(_('data płatności'), null=True, blank=True, db_index=True)

    method = models.CharField(_('metoda'), max_length=20, default='cash')
    type = models.CharField(_('typ'), max_length=20, default='full')
    reference = models.CharField(_('referencja'), max_length=200, blank=True)

    class Meta:
        db_table = 'platnosci';
        verbose_name = _('płatność');
        verbose_name_plural = _('płatności')


class Invoice(TimestampedModel):
    number = models.CharField(_('numer faktury'), max_length=50, unique=True, db_index=True)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='invoices',
                               verbose_name=_('Klient'))
    issue_date = models.DateField(_('data wystawienia'), db_index=True)
    net_amount = models.DecimalField(_('kwota netto'), max_digits=10, decimal_places=2)
    vat_rate = models.DecimalField(_('stawka VAT %'), max_digits=5, decimal_places=2, default=Decimal('23.00'))
    vat_amount = models.DecimalField(_('kwota VAT'), max_digits=10, decimal_places=2)
    gross_amount = models.DecimalField(_('kwota brutto'), max_digits=10, decimal_places=2)
    is_paid = models.BooleanField(_('zapłacona'), default=False, db_index=True)

    appointment = models.ForeignKey(Appointment, on_delete=models.PROTECT, null=True, blank=True,
                                    related_name='invoices', verbose_name=_('Wizyta'))
    sale_date = models.DateField(_('data sprzedaży'))
    due_date = models.DateField(_('termin płatności'), null=True, blank=True)
    paid_date = models.DateField(_('data opłacenia'), null=True, blank=True)
    pdf_file = models.CharField(_('plik PDF'), max_length=500, blank=True)

    class Meta:
        db_table = 'faktury';
        verbose_name = _('faktura');
        verbose_name_plural = _('faktury')

    def save(self, *args, **kwargs):
        if not self.number: self.number = generate_invoice_number(date=self.issue_date)
        if not self.sale_date: self.sale_date = self.issue_date
        self.full_clean()
        super().save(*args, **kwargs)


# ============================================================================
# NOTIFICATIONS & REPORTS
# ============================================================================

class Notification(TimestampedModel):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='notifications',
                               verbose_name=_('Klient'))
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, null=True, blank=True,
                                    related_name='notifications', verbose_name=_('Wizyta'))

    type = models.CharField(_('typ'), max_length=20, default='confirmation')
    channel = models.CharField(_('kanał'), max_length=20, default='email')
    status = models.CharField(_('status'), max_length=20, default='pending')
    scheduled_at = models.DateTimeField(_('termin wysyłki'), default=timezone.now)
    subject = models.CharField(_('temat'), max_length=200, blank=True)
    content = models.TextField(_('treść'))
    sent_at = models.DateTimeField(_('wysłane'), null=True, blank=True)
    error_message = models.TextField(_('komunikat błędu'), blank=True)
    attempts_count = models.PositiveIntegerField(_('liczba prób'), default=0)

    class Meta:
        db_table = 'powiadomienia'
        verbose_name = _('powiadomienie')
        verbose_name_plural = _('powiadomienia')


class ReportPDF(TimestampedModel):
    type = models.CharField(_('typ'), max_length=30)
    title = models.CharField(_('tytuł'), max_length=200)
    file_path = models.CharField(_('ścieżka pliku'), max_length=500)
    data_od = models.DateField(_('data od'), null=True, blank=True)
    data_do = models.DateField(_('data do'), null=True, blank=True)
    file_size = models.PositiveIntegerField(_('rozmiar pliku (B)'), default=0)
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='reports',
                                     verbose_name=_('Wygenerowane przez'))
    parameters = models.JSONField(_('parametry'), default=dict, blank=True)

    class Meta:
        db_table = 'raporty'
        verbose_name = _('raport PDF')
        verbose_name_plural = _('raporty PDF')


# ============================================================================
# LOGGING & SYSTEM SETTINGS
# ============================================================================

class AuditLog(models.Model):
    class Level(models.TextChoices):
        INFO = 'info', _('Info')
        WARNING = 'warning', _('Ostrzeżenie')
        ERROR = 'error', _('Błąd')
        CRITICAL = 'critical', _('Krytyczny')

    type = models.CharField(_('typ'), max_length=50)
    level = models.CharField(_('poziom'), max_length=20, default=Level.INFO, choices=Level.choices)
    timestamp = models.DateTimeField(_('czas'), default=timezone.now, db_index=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs',
                             verbose_name=_('Użytkownik'))
    message = models.TextField(_('komunikat'), blank=True)
    adres_ip = models.GenericIPAddressField(_('adres IP'), null=True, blank=True)
    user_agent = models.CharField(_('user agent'), max_length=500, blank=True)
    entity_type = models.CharField(_('typ encji'), max_length=50, blank=True)
    entity_id = models.CharField(_('ID encji'), max_length=100, blank=True)
    metadata = models.JSONField(_('metadane'), default=dict, blank=True)

    class Meta:
        db_table = 'logi';
        verbose_name = _('log zdarzeń');
        verbose_name_plural = _('logi zdarzeń')


class SystemSettings(TimestampedModel):
    """Singleton - this model always has ID=1."""
    slot_minutes = models.PositiveIntegerField(_('slot minuty'), default=30)
    buffer_minutes = models.PositiveIntegerField(_('bufor minuty'), default=0)
    deposit_policy = models.JSONField(_('polityka zaliczek'), default=dict)
    opening_hours = models.JSONField(_('godziny otwarcia'), default=dict)
    salon_name = models.CharField(_('nazwa salonu'), max_length=200, default='Beauty Salon')
    address = models.CharField(_('adres'), max_length=300, blank=True)
    phone = models.CharField(_('telefon'), max_length=20, blank=True)
    contact_email = models.EmailField(_('email kontaktowy'), blank=True)
    default_vat_rate = models.DecimalField(_('stawka VAT domyślna %'), max_digits=5, decimal_places=2,
                                           default=Decimal('23.00'))
    maintenance_mode = models.BooleanField(_('tryb konserwacji'), default=False)
    maintenance_message = models.TextField(_('komunikat konserwacji'), blank=True)
    last_modified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                         related_name='modyfikacje_ustawien',
                                         verbose_name=_('Ostatnia modyfikacja przez'))

    class Meta:
        db_table = 'ustawienia_systemowe';
        verbose_name = _('ustawienia systemowe');
        verbose_name_plural = _('ustawienia systemowe')

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)
        cache.delete('system_settings')

    @classmethod
    def load(cls):
        cached = cache.get('system_settings')
        if cached: return cached
        obj, _ = cls.objects.get_or_create(pk=1)
        cache.set('system_settings', obj, 3600)
        return obj


class StatsSnapshot(TimestampedModel):
    class Period(models.TextChoices):
        DAILY = 'daily', _('Dzienny')

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
        db_table = 'statystyki_snapshots';
        verbose_name = _('statystyka snapshot');
        verbose_name_plural = _('statystyki snapshots')