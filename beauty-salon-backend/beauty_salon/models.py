# salon/models.py

from decimal import Decimal
from datetime import timedelta, datetime
from django.db import models, transaction
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db.models import JSONField, F, Q
from django.db.models.constraints import CheckConstraint
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

# Importujemy naszą wydzieloną logikę
from .managers import ActiveManager, WizytaManager
from .utils import phone_validator, generate_client_number, calculate_vat


# ============================================================================
# MODELE BAZOWE (BEZ UUID)
# ============================================================================

class TimestampedModel(models.Model):
    """Base model with timestamps. ID będzie auto-incrementing BigAutoField."""
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeletableModel(models.Model):
    """Abstrakcyjny model do 'miękkiego' usuwania."""
    deleted_at = models.DateTimeField(_('usunięte (GDPR)'), null=True, blank=True)

    objects = models.Manager()
    active = ActiveManager()  # Manager z managers.py

    class Meta:
        abstract = True

    def soft_delete(self):
        self.deleted_at = timezone.now()
        self.save()

    def restore(self):
        self.deleted_at = None
        self.save()


# ============================================================================
# USER MANAGEMENT
# ============================================================================

class UserManager(BaseUserManager):
    """Manager dla Usera."""

    def create_user(self, email, password=None, **extra_fields):
        if not email: raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.RoleChoices.MANAGER)
        if extra_fields.get('is_staff') is not True: raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True: raise ValueError('Superuser must have is_superuser=True.')
        if extra_fields.get('role') != User.RoleChoices.MANAGER: raise ValueError('Superuser must have role="manager".')
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, TimestampedModel):
    """Custom user model (dziedziczy po TimestampedModel)."""

    class RoleChoices(models.TextChoices):
        MANAGER = 'manager', _('Manager')
        EMPLOYEE = 'employee', _('Employee')
        CLIENT = 'client', _('Client')

    email = models.EmailField(_('email'), unique=True, db_index=True)
    role = models.CharField(_('role'), max_length=20, choices=RoleChoices.choices, default=RoleChoices.CLIENT,
                            db_index=True)
    is_staff = models.BooleanField(_('staff status'), default=False)
    is_active = models.BooleanField(_('active'), default=True)
    last_login_ip = models.GenericIPAddressField(_('last login IP'), null=True, blank=True)
    failed_login_attempts = models.PositiveIntegerField(_('failed login attempts'), default=0)
    account_locked_until = models.DateTimeField(_('account locked until'), null=True, blank=True)

    objects = UserManager()
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'
        verbose_name = _('user')
        verbose_name_plural = _('users')
        indexes = [models.Index(fields=['email', 'is_active']), models.Index(fields=['role'])]

    def __str__(self):
        return self.email

    def get_role_display_name(self):
        return self.RoleChoices(self.role).label

    def is_manager(self):
        return self.role == self.RoleChoices.MANAGER

    def is_salon_employee(self):
        return self.role == self.RoleChoices.EMPLOYEE

    def is_salon_client(self):
        return self.role == self.RoleChoices.CLIENT

    def can_manage_services(self):
        return self.is_manager()

    def can_manage_employees(self):
        return self.is_manager()

    def can_view_reports(self):
        return self.is_manager() or self.is_salon_employee()

    def can_manage_own_schedule(self):
        return self.is_salon_employee()

    def has_permission_for_appointment(self, wizyta):
        if self.is_manager(): return True
        if self.is_salon_employee() and hasattr(self, 'pracownik'):
            return wizyta.pracownik == self.pracownik
        if self.is_salon_client() and hasattr(self, 'klient'):
            return wizyta.klient == self.klient
        return False


# ============================================================================
# SERVICES
# ============================================================================

class Usluga(TimestampedModel):
    nazwa = models.CharField(_('nazwa'), max_length=200, db_index=True)
    kategoria = models.CharField(_('kategoria'), max_length=100, db_index=True)
    opis = models.TextField(_('opis'), blank=True)
    cena = models.DecimalField(_('cena'), max_digits=10, decimal_places=2,
                               validators=[MinValueValidator(Decimal('0.00'))])
    czas_trwania = models.DurationField(_('czas trwania'))
    zdjecie_url = models.CharField(_('zdjęcie URL'), max_length=500, blank=True)
    publikowana = models.BooleanField(_('publikowana'), default=True, db_index=True)
    promocja = models.JSONField(_('promocja'), null=True, blank=True)
    liczba_rezerwacji = models.PositiveIntegerField(_('liczba rezerwacji'), default=0)

    class Meta:
        db_table = 'uslugi'
        verbose_name = _('usługa')
        verbose_name_plural = _('usługi')
        ordering = ['kategoria', 'nazwa']
        indexes = [
            models.Index(fields=['kategoria', 'publikowana']),
            models.Index(fields=['liczba_rezerwacji']),
        ]

    def __str__(self):
        return self.nazwa

    def clean(self):
        if self.cena < 0: raise ValidationError({'cena': _('Cena nie może być ujemna')})
        if self.czas_trwania.total_seconds() <= 0: raise ValidationError(
            {'czas_trwania': _('Czas trwania musi być większy niż 0')})

    def get_price_with_promotion(self):
        if not self.promocja or not self.promocja.get('active', False):
            return self.cena
        discount_percent = self.promocja.get('discount_percent', 0)
        discounted_price = self.cena * (1 - Decimal(str(discount_percent)) / 100)
        return discounted_price.quantize(Decimal('0.01'))


# ============================================================================
# EMPLOYEES
# ============================================================================

class Pracownik(TimestampedModel):
    nr = models.CharField(_('numer pracownika'), max_length=20, unique=True, db_index=True)
    imie = models.CharField(_('imię'), max_length=100)
    nazwisko = models.CharField(_('nazwisko'), max_length=100)
    user = models.OneToOneField(User, on_delete=models.CASCADE, limit_choices_to={'role': User.RoleChoices.EMPLOYEE},
                                related_name='pracownik')
    kompetencje = models.ManyToManyField(Usluga, related_name='pracownicy', blank=True)
    telefon = models.CharField(_('telefon'), max_length=20, blank=True, validators=[phone_validator])
    data_zatrudnienia = models.DateField(_('data zatrudnienia'), null=True, blank=True)
    aktywny = models.BooleanField(_('aktywny'), default=True, db_index=True)
    liczba_wizyt = models.PositiveIntegerField(_('liczba wizyt'), default=0)
    srednia_ocena = models.DecimalField(_('średnia ocena'), max_digits=3, decimal_places=2, null=True, blank=True,
                                        validators=[MinValueValidator(Decimal('0.0')),
                                                    MaxValueValidator(Decimal('5.0'))])

    class Meta:
        db_table = 'pracownicy'
        verbose_name = _('pracownik')
        verbose_name_plural = _('pracownicy')
        ordering = ['nazwisko', 'imie']
        indexes = [models.Index(fields=['aktywny', 'liczba_wizyt']), ]

    def __str__(self): return f"{self.nr} - {self.imie} {self.nazwisko}"

    def get_full_name(self): return f"{self.imie} {self.nazwisko}"

    def has_competence_for_service(self, usluga): return self.kompetencje.filter(id=usluga.id).exists()


# ============================================================================
# SCHEDULE (Grafik and Urlop)
# ============================================================================

class Urlop(TimestampedModel):
    class StatusChoices(models.TextChoices):
        OCZEKUJACY = 'oczekujacy', _('Oczekujący')
        ZATWIERDZONY = 'zatwierdzony', _('Zatwierdzony')
        ODRZUCONY = 'odrzucony', _('Odrzucony')

    class TypeChoices(models.TextChoices):
        URLOP = 'urlop', _('Urlop')
        CHOROBA = 'choroba', _('Choroba')
        OSOBISTE = 'osobiste', _('Osobiste/Inne')

    pracownik = models.ForeignKey(Pracownik, on_delete=models.CASCADE, related_name='urlopy')
    typ = models.CharField(_('typ'), max_length=20, choices=TypeChoices.choices, default=TypeChoices.URLOP)
    status = models.CharField(_('status'), max_length=20, choices=StatusChoices.choices,
                              default=StatusChoices.OCZEKUJACY)
    data_od = models.DateField(_('data od'))
    data_do = models.DateField(_('data do'))
    powod = models.TextField(_('powód/opis'), blank=True)
    zatwierdzony_przez = models.ForeignKey(User, on_delete=models.SET_NULL,
                                           limit_choices_to={'role': User.RoleChoices.MANAGER}, null=True, blank=True,
                                           related_name='zatwierdzone_urlopy')
    data_zatwierdzenia = models.DateTimeField(_('data zatwierdzenia'), null=True, blank=True)

    class Meta:
        db_table = 'urlopy'
        verbose_name = _('urlop/niedostępność')
        verbose_name_plural = _('urlopy/niedostępności')
        constraints = [
            models.UniqueConstraint(fields=['pracownik', 'data_od', 'data_do'], name='unique_employee_timeoff'),
            models.CheckConstraint(check=Q(data_do__gte=F('data_od')), name='urlop_valid_dates')  # SUGESTIA 2
        ]

    def __str__(self):
        return f"Urlop {self.pracownik} ({self.data_od} do {self.data_do})"

    def clean(self):
        if self.data_do < self.data_od: raise ValidationError(
            {'data_do': 'Data końca musi być późniejsza niż data początku.'})
        overlapping = Urlop.objects.filter(
            pracownik=self.pracownik, status__in=[self.StatusChoices.OCZEKUJACY, self.StatusChoices.ZATWIERDZONY],
            data_od__lte=self.data_do, data_do__gte=self.data_od
        ).exclude(pk=self.pk)
        if overlapping.exists(): raise ValidationError('Wykryto nakładające się urlopy dla tego pracownika.')

    def save(self, *args, **kwargs):
        with transaction.atomic():  # SUGESTIA 9
            self.full_clean()
            super().save(*args, **kwargs)


class Grafik(TimestampedModel):
    class StatusChoices(models.TextChoices):
        AKTYWNY = 'aktywny', _('Aktywny')
        OCZEKUJACY = 'oczekujacy', _('Oczekujący na zatwierdzenie')
        ARCHIWUM = 'archiwum', _('Archiwum')

    pracownik = models.ForeignKey(Pracownik, on_delete=models.CASCADE, related_name='grafiki')
    okresy_dostepnosci = models.JSONField(_('okresy dostępności'), default=list,
                                          help_text='Format: [{"day": "Monday", "start": "09:00", "end": "17:00"}]')
    przerwy = models.JSONField(_('przerwy'), default=list, help_text='Format: [{"start": "12:00", "end": "12:30"}]')
    status = models.CharField(_('status'), max_length=20, choices=StatusChoices.choices, default=StatusChoices.AKTYWNY)

    class Meta:
        db_table = 'grafiki'
        verbose_name = _('grafik')
        verbose_name_plural = _('grafiki')
        ordering = ['-created_at']

    def __str__(self):
        return f"Grafik - {self.pracownik} ({self.get_status_display()})"

    def clean(self):
        valid_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        if self.okresy_dostepnosci:
            for okres in self.okresy_dostepnosci:
                if okres.get('day') not in valid_days: raise ValidationError(
                    {'okresy_dostepnosci': _('Nieprawidłowy dzień tygodnia')})
                try:
                    datetime.strptime(okres.get('start', ''), '%H:%M')
                    datetime.strptime(okres.get('end', ''), '%H:%M')
                except (ValueError, TypeError):
                    raise ValidationError({'okresy_dostepnosci': _('Nieprawidłowy format czasu (użyj HH:MM)')})

    def is_available_on_date(self, date):
        return not Urlop.objects.filter(
            pracownik=self.pracownik, status__in=[Urlop.StatusChoices.OCZEKUJACY, Urlop.StatusChoices.ZATWIERDZONY],
            data_od__lte=date, data_do__gte=date
        ).exists()


# ============================================================================
# CLIENTS
# ============================================================================

class Klient(SoftDeletableModel, TimestampedModel):
    class KontaktChoices(models.TextChoices):
        EMAIL = 'email', _('Email')
        TELEFON = 'telefon', _('Telefon')
        SMS = 'sms', _('SMS')

    imie = models.CharField(_('imię'), max_length=100)
    nazwisko = models.CharField(_('nazwisko'), max_length=100)
    email = models.EmailField(_('email'), db_index=True)
    telefon = models.CharField(_('telefon'), max_length=20, blank=True, validators=[phone_validator])
    nr = models.CharField(_('numer klienta'), max_length=20, unique=True, db_index=True)
    user = models.OneToOneField(User, on_delete=models.SET_NULL, limit_choices_to={'role': User.RoleChoices.CLIENT},
                                null=True, blank=True, related_name='klient')
    zgoda_marketing = models.BooleanField(_('zgoda marketingowa'), default=False)
    preferowany_kontakt = models.CharField(_('preferowany kontakt'), max_length=20, choices=KontaktChoices.choices,
                                           default=KontaktChoices.EMAIL)
    liczba_wizyt = models.PositiveIntegerField(_('liczba wizyt'), default=0)
    laczna_wydana_kwota = models.DecimalField(_('łączna wydana kwota'), max_digits=12, decimal_places=2,
                                              default=Decimal('0.00'))
    notatki_wewnetrzne = models.TextField(_('notatki wewnętrzne'), blank=True)

    class Meta:
        db_table = 'klienci'
        verbose_name = _('klient')
        verbose_name_plural = _('klienci')
        ordering = ['nazwisko', 'imie']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['telefon']),
            models.Index(fields=['liczba_wizyt']),
            models.Index(fields=['deleted_at']),
        ]

    def __str__(self):
        if self.deleted_at: return f"[USUNIĘTY] {self.id}"
        return f"{self.nr} - {self.imie} {self.nazwisko}"

    def get_full_name(self):
        if self.deleted_at: return "[USUNIĘTY]"
        return f"{self.imie} {self.nazwisko}"

    def soft_delete(self):
        self.imie = "USUNIĘTY"
        self.nazwisko = "USUNIĘTY"
        self.email = f"deleted_{self.id}@deleted.local"
        self.telefon = ""
        self.notatki_wewnetrzne = ""
        super().soft_delete()

    def save(self, *args, **kwargs):
        if not self.nr:
            self.nr = generate_client_number()
        super().save(*args, **kwargs)


# ============================================================================
# RESERVATIONS
# ============================================================================

class Wizyta(TimestampedModel):
    class StatusChoices(models.TextChoices):
        OCZEKUJACA = 'oczekujaca', _('Oczekująca')
        POTWIERDZONA = 'potwierdzona', _('Potwierdzona')
        W_TRAKCIE = 'w_trakcie', _('W trakcie')
        ZREALIZOWANA = 'zrealizowana', _('Zrealizowana')
        ODWOLANA = 'odwolana', _('Odwołana')
        NO_SHOW = 'no_show', _('No-show')

    class ChannelChoices(models.TextChoices):
        WEB = 'web', _('Strona WWW')
        TELEFON = 'telefon', _('Telefon')
        OSOBISCIE = 'osobiscie', _('Osobiście')
        PRACOWNIK = 'pracownik', _('Przez pracownika')

    klient = models.ForeignKey(Klient, on_delete=models.PROTECT, related_name='wizyty')
    pracownik = models.ForeignKey(Pracownik, on_delete=models.PROTECT, related_name='wizyty')
    usluga = models.ForeignKey(Usluga, on_delete=models.PROTECT, related_name='wizyty')
    status = models.CharField(_('status'), max_length=20, choices=StatusChoices.choices,
                              default=StatusChoices.OCZEKUJACA, db_index=True)
    termin_start = models.DateTimeField(_('termin start'), db_index=True)
    termin_koniec = models.DateTimeField(_('termin koniec'))
    timespan = models.CharField(_('zakres czasu'), max_length=255, blank=True, null=True,
                                help_text="Tymczasowy placeholder")
    kanal_rezerwacji = models.CharField(_('kanał rezerwacji'), max_length=20, choices=ChannelChoices.choices,
                                        default=ChannelChoices.WEB)
    notatki_klienta = models.TextField(_('notatki klienta'), blank=True)
    notatki_wewnetrzne = models.TextField(_('notatki wewnętrzne'), blank=True)
    anulowana_przez = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name='anulowane_wizyty')
    data_anulowania = models.DateTimeField(_('data anulowania'), null=True, blank=True)
    powod_anulowania = models.TextField(_('powód anulowania'), blank=True)
    przypomnienie_wyslane = models.BooleanField(_('przypomnienie wysłane'), default=False)
    data_wyslania_przypomnienia = models.DateTimeField(null=True, blank=True)

    objects = WizytaManager()

    class Meta:
        db_table = 'wizyty'
        verbose_name = _('wizyta')
        verbose_name_plural = _('wizyty')
        ordering = ['-termin_start']
        indexes = [
            models.Index(fields=['pracownik', 'termin_start']),
            models.Index(fields=['klient', 'status']),
            models.Index(fields=['status', 'termin_start']),
        ]
        constraints = [
            models.CheckConstraint(check=Q(termin_koniec__gt=F('termin_start')), name='wizyty_end_after_start'),
            # Usunięto ExclusionConstraint, by uniknąć błędu GiST/BigInt
        ]

    def __str__(self):
        client_name = self.klient.get_full_name() if self.klient else _("Brak klienta")
        service_name = self.usluga.nazwa if self.usluga else _("Brak usługi")
        return f"{client_name} - {service_name} ({self.termin_start.strftime('%Y-%m-%d %H:%M')})"

    def clean(self):
        active_statuses = [self.StatusChoices.OCZEKUJACA, self.StatusChoices.POTWIERDZONA, self.StatusChoices.W_TRAKCIE]
        if self.termin_koniec and self.termin_start and self.termin_koniec <= self.termin_start: raise ValidationError(
            {'termin_koniec': _('Termin końca musi być po terminie startu')})
        if self.pracownik_id and self.status in active_statuses:
            overlapping = Wizyta.objects.filter(
                pracownik=self.pracownik, status__in=active_statuses,
                termin_start__lt=self.termin_koniec, termin_koniec__gt=self.termin_start
            ).exclude(pk=self.pk)
            if overlapping.exists(): raise ValidationError(
                {'pracownik': _('Pracownik jest zajęty w podanym terminie.')})
        if self.pracownik and self.usluga:
            if not self.pracownik.has_competence_for_service(self.usluga): raise ValidationError(
                {'pracownik': _('Pracownik nie ma kompetencji do wykonania tej usługi')})
        if not self.pk and self.termin_start and self.termin_start <= timezone.now(): raise ValidationError(
            {'termin_start': _('Nie można rezerwować wizyt w przeszłości')})
        if self.klient and self.status in active_statuses:
            overlapping = Wizyta.objects.filter(
                klient=self.klient, status__in=active_statuses,
                termin_start__lt=self.termin_koniec, termin_koniec__gt=self.termin_start
            ).exclude(pk=self.pk)
            if overlapping.exists(): raise ValidationError({'termin_start': _('Klient ma już wizytę w tym czasie')})
        if self.termin_start and self.termin_koniec:
            expected_duration = self.termin_koniec - self.termin_start
            if self.usluga and abs(self.usluga.czas_trwania.total_seconds() - expected_duration.total_seconds()) > 1:
                raise ValidationError(
                    {'termin_koniec': _(f'Czas trwania musi wynosić dokładnie {self.usluga.czas_trwania}')})

    def save(self, *args, **kwargs):
        with transaction.atomic():
            if self.usluga and self.termin_start and not self.termin_koniec:
                self.termin_koniec = self.termin_start + self.usluga.czas_trwania

            # Wyczyściliśmy pole timespan i wyłączyliśmy GiST - ta linia zostaje jako placeholder
            if self.termin_start and self.termin_koniec:
                self.timespan = f"[{self.termin_start.isoformat()},{self.termin_koniec.isoformat()})"

            self.full_clean()
            super().save(*args, **kwargs)

    def can_be_cancelled(self):
        if self.status in [self.StatusChoices.ODWOLANA, self.StatusChoices.NO_SHOW, self.StatusChoices.ZREALIZOWANA]:
            return False
        settings = UstawieniaSystemowe.load()
        if settings and settings.polityka_zaliczek:
            hours_before = settings.polityka_zaliczek.get('godziny_anulowania', 24)
            cancellation_deadline = self.termin_start - timedelta(hours=hours_before)
            return timezone.now() <= cancellation_deadline
        return True


# ============================================================================
# POZOSTAŁE MODELE (Notatka, Material, Platnosc, Faktura...)
# ============================================================================

class Notatka(TimestampedModel):
    wizyta = models.ForeignKey(Wizyta, on_delete=models.CASCADE, related_name='notatki')
    tresc = models.TextField(_('treść'))
    autor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='notatki')
    widoczna_dla_klienta = models.BooleanField(_('widoczna dla klienta'), default=False)

    class Meta:
        db_table = 'notatki'
        ordering = ['-created_at']
        verbose_name = _('notatka')
        verbose_name_plural = _('notatki')


class Material(TimestampedModel):
    class TypeChoices(models.TextChoices):
        PORTFOLIO = 'portfolio', _('Portfolio')
        USLUGA = 'usluga', _('Zdjęcie usługi')
        INNE = 'inne', _('Inne')

    typ = models.CharField(_('typ'), max_length=20, choices=TypeChoices.choices, default=TypeChoices.PORTFOLIO)
    url = models.CharField(_('URL'), max_length=500)
    opis = models.TextField(_('opis'), blank=True)
    wlasciciel_prac = models.ForeignKey(Pracownik, on_delete=models.PROTECT, related_name='materialy')
    nazwa_pliku = models.CharField(_('nazwa pliku'), max_length=255, blank=True)
    rozmiar_bajtow = models.PositiveIntegerField(_('rozmiar (B)'), null=True, blank=True)
    mime_type = models.CharField(_('MIME type'), max_length=100, blank=True)
    aktywny = models.BooleanField(_('aktywny'), default=True, db_index=True)

    class Meta:
        db_table = 'materialy'
        verbose_name = _('materiał')
        verbose_name_plural = _('materiały')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['wlasciciel_prac', 'aktywny']),
            models.Index(fields=['typ', 'aktywny']),
        ]


class Platnosc(TimestampedModel):
    class StatusChoices(models.TextChoices): OCZEKUJACA = 'oczekujaca', _('Oczekująca'); ZAPLACONA = 'zaplacona', _(
        'Zapłacona'); ZWROCONA = 'zwrocona', _('Zwrócona'); PRZEPADLA = 'przepadla', _('Przepadła')

    class TypeChoices(models.TextChoices): ZALICZKA = 'zaliczka', _('Zaliczka'); PLATNOSC_PELNA = 'platnosc_pelna', _(
        'Płatność pełna'); KARA = 'kara', _('Kara za no-show')

    class MethodChoices(models.TextChoices): GOTOWKA = 'gotowka', _('Gotówka'); KARTA = 'karta', _(
        'Karta'); PRZELEW = 'przelew', _('Przelew'); ONLINE = 'online', _('Płatność online')

    wizyta = models.ForeignKey(Wizyta, on_delete=models.PROTECT, related_name='platnosci', null=True, blank=True)
    kwota = models.DecimalField(_('kwota'), max_digits=10, decimal_places=2,
                                validators=[MinValueValidator(Decimal('0.00'))])
    status = models.CharField(_('status'), max_length=20, choices=StatusChoices.choices,
                              default=StatusChoices.OCZEKUJACA, db_index=True)
    typ = models.CharField(_('typ'), max_length=20, choices=TypeChoices.choices, default=TypeChoices.PLATNOSC_PELNA)
    metoda_platnosci = models.CharField(_('metoda płatności'), max_length=20, choices=MethodChoices.choices,
                                        default=MethodChoices.GOTOWKA)
    data_platnosci = models.DateTimeField(_('data płatności'), null=True, blank=True, db_index=True)
    reference = models.CharField(_('referencja'), max_length=200, blank=True)

    class Meta:
        db_table = 'platnosci'
        ordering = ['-created_at']
        verbose_name = _('płatność')
        verbose_name_plural = _('płatności')
        indexes = [
            models.Index(fields=['status', 'typ']),
            models.Index(fields=['wizyta']),
        ]


class Faktura(TimestampedModel):
    numer = models.CharField(_('numer faktury'), max_length=50, unique=True, db_index=True)
    klient = models.ForeignKey(Klient, on_delete=models.PROTECT, related_name='faktury')
    wizyta = models.ForeignKey(Wizyta, on_delete=models.PROTECT, null=True, blank=True, related_name='faktury')
    data_wystawienia = models.DateField(_('data wystawienia'), db_index=True)
    data_sprzedazy = models.DateField(_('data sprzedaży'))
    termin_platnosci = models.DateField(_('termin płatności'), null=True, blank=True)
    kwota_netto = models.DecimalField(_('kwota netto'), max_digits=10, decimal_places=2,
                                      validators=[MinValueValidator(Decimal('0.00'))])
    stawka_vat = models.DecimalField(_('stawka VAT %'), max_digits=5, decimal_places=2, default=Decimal('23.00'))
    kwota_vat = models.DecimalField(_('kwota VAT'), max_digits=10, decimal_places=2)
    kwota_brutto = models.DecimalField(_('kwota brutto'), max_digits=10, decimal_places=2)
    zaplacona = models.BooleanField(_('zapłacona'), default=False, db_index=True)
    data_zaplaty = models.DateField(_('data zapłaty'), null=True, blank=True)
    plik_pdf = models.CharField(_('plik PDF'), max_length=500, blank=True)

    class Meta:
        db_table = 'faktury'
        ordering = ['-data_wystawienia', '-numer']
        verbose_name = _('faktura')
        verbose_name_plural = _('faktury')
        indexes = [
            models.Index(fields=['klient', 'data_wystawienia']),
            models.Index(fields=['zaplacona', 'termin_platnosci']),
        ]

    def __str__(self):
        return f"Faktura {self.numer} - {self.kwota_brutto} PLN"

    def clean(self):
        if self.kwota_netto < 0: raise ValidationError({'kwota_netto': _('Kwota netto nie może być ujemna')})
        calculated_vat, calculated_brutto = calculate_vat(self.kwota_netto, self.stawka_vat)
        if abs(self.kwota_vat - calculated_vat) > Decimal('0.02'): raise ValidationError(
            {'kwota_vat': _('Nieprawidłowa kwota VAT.')})
        if abs(self.kwota_brutto - calculated_brutto) > Decimal('0.02'): raise ValidationError(
            {'kwota_brutto': _('Nieprawidłowa kwota brutto.')})


class Powiadomienie(TimestampedModel):
    class TypeChoices(models.TextChoices): POTWIERDZENIE = 'potwierdzenie', _(
        'Potwierdzenie rezerwacji'); PRZYPOMNIENIE = 'przypomnienie', _(
        'Przypomnienie o wizycie'); ANULOWANIE = 'anulowanie', _('Anulowanie wizyty'); ZMIANA = 'zmiana', _(
        'Zmiana terminu'); PROMOCJA = 'promocja', _('Promocja')

    class ChannelChoices(models.TextChoices): EMAIL = 'email', _('Email'); SMS = 'sms', _('SMS'); PUSH = 'push', _(
        'Push notification')

    class StatusChoices(models.TextChoices): OCZEKUJACE = 'oczekujace', _('Oczekujące'); WYSLANE = 'wyslane', _(
        'Wysłane'); DOSTARCZONE = 'dostarczone', _('Dostarczone'); BLAD = 'blad', _('Błąd')

    typ = models.CharField(_('typ'), max_length=20, choices=TypeChoices.choices)
    kanal = models.CharField(_('kanał'), max_length=20, choices=ChannelChoices.choices)
    status = models.CharField(_('status'), max_length=20, choices=StatusChoices.choices,
                              default=StatusChoices.OCZEKUJACE, db_index=True)
    tresc = models.TextField(_('treść'))
    temat = models.CharField(_('temat'), max_length=200, blank=True)
    termin_wysylki = models.DateTimeField(_('termin wysyłki'), db_index=True)
    data_wyslania = models.DateTimeField(_('data wysłania'), null=True, blank=True)
    klient = models.ForeignKey(Klient, on_delete=models.CASCADE, related_name='powiadomienia')
    wizyta = models.ForeignKey(Wizyta, on_delete=models.CASCADE, null=True, blank=True, related_name='powiadomienia')
    liczba_prob = models.PositiveIntegerField(_('liczba prób'), default=0)
    komunikat_bledu = models.TextField(_('komunikat błędu'), blank=True)

    class Meta:
        db_table = 'powiadomienia'
        ordering = ['termin_wysylki']
        verbose_name = _('powiadomienie')
        verbose_name_plural = _('powiadomienia')
        indexes = [
            models.Index(fields=['status', 'termin_wysylki']),
            models.Index(fields=['klient', 'typ']),
        ]


class RaportPDF(TimestampedModel):
    class TypeChoices(models.TextChoices):
        LISTA_WIZYT = 'lista_wizyt', _('Lista wizyt')
        LISTA_KLIENTOW = 'lista_klientow', _('Lista klientów')
        OBLOZENIE_PRACOWNIKOW = 'oblozenie_pracownikow', _('Obłożenie pracowników')
        TOP_USLUGI = 'top_uslugi', _('Najpopularniejsze usługi')
        ANULACJE_NOSHOW = 'anulacje_noshow', _('Anulacje i no-show')
        RAPORT_FINANSOWY = 'raport_finansowy', _('Raport finansowy')

    typ = models.CharField(_('typ'), max_length=30, choices=TypeChoices.choices, db_index=True)
    tytul = models.CharField(_('tytuł'), max_length=200)
    sciezka_pliku = models.CharField(_('ścieżka pliku'), max_length=500)
    data_od = models.DateField(_('data od'), null=True, blank=True)
    data_do = models.DateField(_('data do'), null=True, blank=True)
    parametry = models.JSONField(_('parametry'), default=dict, blank=True)
    wygenerowany_przez = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='raporty')
    rozmiar_pliku = models.PositiveIntegerField(_('rozmiar pliku (B)'), default=0)

    class Meta:
        db_table = 'raporty'
        ordering = ['-created_at']
        verbose_name = _('raport PDF')
        verbose_name_plural = _('raporty PDF')


class LogEntry(TimestampedModel):
    class TypeChoices(models.TextChoices):
        REZERWACJA = 'rezerwacja', _('Rezerwacja wizyty')
        ZMIANA_STATUSU = 'zmiana_statusu', _('Zmiana statusu wizyty')
        PLATNOSC = 'platnosc', _('Płatność')
        DODANIE_USLUGI = 'dodanie_uslugi', _('Dodanie usługi')
        REJESTRACJA_KLIENTA = 'rejestracja_klienta', _('Rejestracja klienta')
        LOGIN = 'login', _('Logowanie')
        ZMIANA_USTAWIEN = 'zmiana_ustawien', _('Zmiana ustawień')
        INNE = 'inne', _('Inne')

    class LevelChoices(models.TextChoices):
        INFO = 'info', _('Info')
        WARNING = 'warning', _('Ostrzeżenie')
        ERROR = 'error', _('Błąd')
        CRITICAL = 'critical', _('Krytyczny')

    czas = models.DateTimeField(_('czas'), auto_now_add=True, db_index=True)
    typ = models.CharField(_('typ'), max_length=30, choices=TypeChoices.choices, db_index=True)
    poziom = models.CharField(_('poziom'), max_length=20, choices=LevelChoices.choices, default=LevelChoices.INFO)
    opis = models.TextField(_('opis'))
    uzytkownik = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='log_entries')
    adres_ip = models.GenericIPAddressField(_('adres IP'), null=True, blank=True)
    user_agent = models.CharField(_('user agent'), max_length=500, blank=True)
    entity_type = models.CharField(_('typ encji'), max_length=50, blank=True)

    entity_id = models.PositiveBigIntegerField(_('ID encji'), null=True, blank=True, db_index=True)

    metadata = models.JSONField(_('metadane'), default=dict, blank=True)

    class Meta:
        db_table = 'logi'
        ordering = ['-czas']
        verbose_name = _('log entry')
        verbose_name_plural = _('log entries')
        indexes = [
            models.Index(fields=['typ', 'czas']),
            models.Index(fields=['uzytkownik', 'czas']),
            models.Index(fields=['entity_type', 'entity_id']),
        ]


class UstawieniaSystemowe(TimestampedModel):
    """Singleton - ten model zawsze będzie miał ID=1."""
    slot_minuty = models.PositiveIntegerField(_('slot minuty'), default=30,
                                              validators=[MinValueValidator(5), MaxValueValidator(120)])
    bufor_minuty = models.PositiveIntegerField(_('bufor minuty'), default=0, validators=[MaxValueValidator(60)])
    polityka_zaliczek = models.JSONField(_('polityka zaliczek'), default=dict,
                                         help_text='{"wymagana": true, "procent": 20, "godziny_anulowania": 24}')
    harmonogram_powiadomien = models.JSONField(_('harmonogram powiadomień'), default=dict,
                                               help_text='{"potwierdzenie": "natychmiast", "przypomnienie_godziny": 24}')
    godziny_otwarcia = models.JSONField(_('godziny otwarcia'), default=dict,
                                        help_text='{"poniedzialek": {"start": "09:00", "end": "18:00"}}')
    nazwa_salonu = models.CharField(_('nazwa salonu'), max_length=200, default='Beauty Salon')
    adres = models.CharField(_('adres'), max_length=300, blank=True)
    telefon = models.CharField(_('telefon'), max_length=20, blank=True,
                               validators=[phone_validator])  # Dodano walidator
    email_kontaktowy = models.EmailField(_('email kontaktowy'), blank=True)
    stawka_vat_domyslna = models.DecimalField(_('stawka VAT domyślna %'), max_digits=5, decimal_places=2,
                                              default=Decimal('23.00'))
    tryb_konserwacji = models.BooleanField(_('tryb konserwacji'), default=False)
    komunikat_konserwacji = models.TextField(_('komunikat konserwacji'), blank=True)
    ostatnia_modyfikacja_przez = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                                   related_name='modyfikacje_ustawien')

    class Meta:
        db_table = 'ustawienia'
        verbose_name = _('ustawienia systemowe')
        verbose_name_plural = _('ustawienia systemowe')

    def __str__(self): return f"{self.nazwa_salonu} - Ustawienia"

    def save(self, *args, **kwargs):
        self.pk = 1  # Wymuszenie wzorca Singleton
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        """Pobiera lub tworzy instancję singletona."""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class StatystykaSnapshot(TimestampedModel):
    class PeriodChoices(models.TextChoices): DZIENNY = 'dzienny', _('Dzienny'); TYGODNIOWY = 'tygodniowy', _(
        'Tygodniowy'); MIESIECZNY = 'miesieczny', _('Miesięczny')

    okres = models.CharField(_('okres'), max_length=20, choices=PeriodChoices.choices)
    data_od = models.DateField(_('data od'), db_index=True)
    data_do = models.DateField(_('data do'))
    liczba_wizyt_total = models.PositiveIntegerField(_('liczba wizyt (total)'), default=0)
    liczba_wizyt_zrealizowanych = models.PositiveIntegerField(_('liczba wizyt zrealizowanych'), default=0)
    liczba_anulacji = models.PositiveIntegerField(_('liczba anulacji'), default=0)
    liczba_noshow = models.PositiveIntegerField(_('liczba no-show'), default=0)
    przychod_total = models.DecimalField(_('przychód total'), max_digits=12, decimal_places=2, default=Decimal('0.00'))
    przychod_zaliczek = models.DecimalField(_('przychód z zaliczek'), max_digits=12, decimal_places=2,
                                            default=Decimal('0.00'))
    liczba_nowych_klientow = models.PositiveIntegerField(_('liczba nowych klientów'), default=0)
    liczba_powracajacych_klientow = models.PositiveIntegerField(_('liczba powracających klientów'), default=0)
    srednie_oblozenie_pracownikow = models.DecimalField(_('średnie obłożenie pracowników %'), max_digits=5,
                                                        decimal_places=2, default=Decimal('0.00'))
    dodatkowe_metryki = models.JSONField(_('dodatkowe metryki'), default=dict, blank=True)

    class Meta:
        db_table = 'statystyki_snapshots'
        verbose_name = _('statystyka snapshot')
        verbose_name_plural = _('statystyki snapshots')
        ordering = ['-data_od']
        indexes = [models.Index(fields=['okres', 'data_od']), ]
        unique_together = [['okres', 'data_od']]

    def __str__(self): return f"Statystyki {self.get_okres_display()} - {self.data_od}"