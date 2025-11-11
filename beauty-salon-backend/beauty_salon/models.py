import uuid
from decimal import Decimal
from datetime import timedelta
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.contrib.postgres.fields import DateTimeRangeField
from django.db.models import JSONField, F, Q
from django.db.models.constraints import CheckConstraint
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from psycopg2.extras import DateTimeTZRange


# ============================================================================
# BASE MIXIN
# ============================================================================

class UUIDTimestampedModel(models.Model):
    """Base mixin with UUID primary key and timestamps."""
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ============================================================================
# USER MANAGEMENT
# ============================================================================

class UserManager(BaseUserManager):
    """Manager for custom user model."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'manager')
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, UUIDTimestampedModel):
    """Custom user model."""
    email = models.EmailField(_('email'), unique=True, db_index=True)

    ROLE_CHOICES = [
        ('manager', _('Manager')),
        ('employee', _('Employee')),
        ('client', _('Client')),
    ]

    role = models.CharField(
        _('role'),
        max_length=20,
        choices=ROLE_CHOICES,
        default='client',
        db_index=True,
        help_text=_('Business role in the salon system')
    )

    is_staff = models.BooleanField(
        _('staff status'),
        default=False,
        help_text=_('Django admin panel access')
    )
    is_active = models.BooleanField(_('active'), default=True)

    last_login_ip = models.GenericIPAddressField(
        _('last login IP'),
        null=True,
        blank=True
    )
    failed_login_attempts = models.PositiveIntegerField(
        _('failed login attempts'),
        default=0
    )
    account_locked_until = models.DateTimeField(
        _('account locked until'),
        null=True,
        blank=True
    )

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'
        verbose_name = _('user')
        verbose_name_plural = _('users')
        indexes = [
            models.Index(fields=['email', 'is_active']),
            models.Index(fields=['role']),
            models.Index(fields=['role', 'is_active']),
        ]

    def __str__(self):
        return self.email

    def get_role_display_name(self):
        return dict(self.ROLE_CHOICES).get(self.role, 'Unknown')

    def is_manager(self):
        return self.role == 'manager'

    def is_salon_employee(self):
        return self.role == 'employee'

    def is_salon_client(self):
        return self.role == 'client'


# ============================================================================
# SERVICES
# ============================================================================

class Usluga(UUIDTimestampedModel):
    """Service entity from PDF metody_klasy.pdf."""
    nazwa = models.CharField(_('nazwa'), max_length=200, db_index=True)
    kategoria = models.CharField(_('kategoria'), max_length=100, db_index=True)
    opis = models.TextField(_('opis'), blank=True)
    cena = models.DecimalField(
        _('cena'),
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    czas_trwania = models.DurationField(_('czas trwania'))
    zdjecie_url = models.CharField(_('zdjęcie URL'), max_length=500, blank=True)
    publikowana = models.BooleanField(_('publikowana'), default=True, db_index=True)

    promocja = JSONField(_('promocja'), null=True, blank=True)

    liczba_rezerwacji = models.PositiveIntegerField(
        _('liczba rezerwacji'),
        default=0,
        help_text=_('Denormalized counter for statistics')
    )

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


# ============================================================================
# EMPLOYEES
# ============================================================================

class Pracownik(UUIDTimestampedModel):
    """Employee entity from PDF metody_klasy.pdf."""
    nr = models.CharField(_('numer pracownika'), max_length=20, unique=True, db_index=True)
    imie = models.CharField(_('imię'), max_length=100)
    nazwisko = models.CharField(_('nazwisko'), max_length=100)

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'employee'},
        related_name='pracownik',
        verbose_name=_('użytkownik')
    )

    kompetencje = models.ManyToManyField(
        Usluga,
        related_name='pracownicy',
        verbose_name=_('kompetencje'),
        blank=True
    )

    telefon = models.CharField(_('telefon'), max_length=20, blank=True)
    data_zatrudnienia = models.DateField(_('data zatrudnienia'), null=True, blank=True)
    aktywny = models.BooleanField(_('aktywny'), default=True, db_index=True)

    liczba_wizyt = models.PositiveIntegerField(_('liczba wizyt'), default=0)
    srednia_ocena = models.DecimalField(
        _('średnia ocena'),
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.0')), MaxValueValidator(Decimal('5.0'))]
    )

    class Meta:
        db_table = 'pracownicy'
        verbose_name = _('pracownik')
        verbose_name_plural = _('pracownicy')
        ordering = ['nazwisko', 'imie']
        indexes = [
            models.Index(fields=['aktywny', 'liczba_wizyt']),
        ]

    def __str__(self):
        return f"{self.nr} - {self.imie} {self.nazwisko}"

    def get_full_name(self):
        return f"{self.imie} {self.nazwisko}"


# ============================================================================
# SCHEDULE (Grafik and Urlop)
# ============================================================================

class Urlop(UUIDTimestampedModel):
    """Time-off model - demonstracja approval workflow dla pracy."""
    STATUS_CHOICES = [
        ('oczekujacy', _('Oczekujący')),
        ('zatwierdzony', _('Zatwierdzony')),
        ('odrzucony', _('Odrzucony')),
    ]
    TYPE_CHOICES = [
        ('urlop', _('Urlop')),
        ('choroba', _('Choroba')),
        ('osobiste', _('Osobiste/Inne')),
    ]

    pracownik = models.ForeignKey(
        Pracownik,
        on_delete=models.CASCADE,
        related_name='urlopy',
        verbose_name=_('pracownik')
    )
    typ = models.CharField(_('typ'), max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=STATUS_CHOICES,
        default='oczekujacy'
    )
    data_od = models.DateField(_('data od'))
    data_do = models.DateField(_('data do'))
    powod = models.TextField(_('powód/opis'), blank=True)

    zatwierdzony_przez = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        limit_choices_to={'role': 'manager'},
        null=True, blank=True,
        related_name='zatwierdzone_urlopy'
    )
    data_zatwierdzenia = models.DateTimeField(_('data zatwierdzenia'), null=True, blank=True)

    class Meta:
        db_table = 'urlopy'
        verbose_name = _('urlop/niedostępność')
        verbose_name_plural = _('urlopy/niedostępności')
        constraints = [
            models.UniqueConstraint(fields=['pracownik', 'data_od', 'data_do'], name='unique_employee_timeoff')
        ]

    def __str__(self):
        return f"Urlop {self.pracownik} ({self.data_od} do {self.data_do})"

    def clean(self):
        """Walidacja nakładania się urlopów i dat."""
        if self.data_do < self.data_od:
            raise ValidationError({'data_do': 'Data końca musi być późniejsza niż data początku.'})

        overlapping = Urlop.objects.filter(
            pracownik=self.pracownik,
            status__in=['oczekujacy', 'zatwierdzony'],
            data_od__lte=self.data_do,
            data_do__gte=self.data_od
        ).exclude(pk=self.pk)

        if overlapping.exists():
            raise ValidationError('Wykryto nakładające się urlopy dla tego pracownika.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Grafik(UUIDTimestampedModel):
    """Schedule entity from PDF metody_klasy.pdf."""
    pracownik = models.ForeignKey(
        Pracownik,
        on_delete=models.CASCADE,
        related_name='grafiki',
        verbose_name=_('pracownik')
    )

    okresy_dostepnosci = JSONField(
        _('okresy dostępności'),
        default=list,
        help_text=_('Format: [{"day": "Monday", "start": "09:00", "end": "17:00"}, ...]')
    )
    przerwy = JSONField(
        _('przerwy'),
        default=list,
        help_text=_('Format: [{"start": "12:00", "end": "12:30"}, ...]')
    )

    STATUS_CHOICES = [
        ('aktywny', _('Aktywny')),
        ('oczekujacy', _('Oczekujący na zatwierdzenie')),
        ('archiwum', _('Archiwum')),
    ]
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=STATUS_CHOICES,
        default='aktywny'
    )

    class Meta:
        db_table = 'grafiki'
        verbose_name = _('grafik')
        verbose_name_plural = _('grafiki')
        ordering = ['-created_at']

    def __str__(self):
        return f"Grafik - {self.pracownik} ({self.get_status_display()})"


# ============================================================================
# CLIENTS
# ============================================================================

class ActiveClientsManager(models.Manager):
    """Filtruje klientów, którzy nie zostali oznaczoni jako usunięci (GDPR)."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Klient(UUIDTimestampedModel):
    """Client entity from PDF metody_klasy.pdf."""
    imie = models.CharField(_('imię'), max_length=100)
    nazwisko = models.CharField(_('nazwisko'), max_length=100)
    email = models.EmailField(_('email'), db_index=True)
    telefon = models.CharField(_('telefon'), max_length=20, blank=True)

    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        limit_choices_to={'role': 'client'},
        null=True,
        blank=True,
        related_name='klient',
        verbose_name=_('użytkownik')
    )

    deleted_at = models.DateTimeField(_('usunięte (GDPR)'), null=True, blank=True)

    zgoda_marketing = models.BooleanField(_('zgoda marketingowa'), default=False)
    preferowany_kontakt = models.CharField(
        _('preferowany kontakt'),
        max_length=20,
        choices=[
            ('email', _('Email')),
            ('telefon', _('Telefon')),
            ('sms', _('SMS')),
        ],
        default='email'
    )

    liczba_wizyt = models.PositiveIntegerField(_('liczba wizyt'), default=0)
    laczna_wydana_kwota = models.DecimalField(
        _('łączna wydana kwota'),
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )

    notatki_wewnetrzne = models.TextField(_('notatki wewnętrzne'), blank=True)

    objects = models.Manager()
    active = ActiveClientsManager()

    class Meta:
        db_table = 'klienci'
        verbose_name = _('klient')
        verbose_name_plural = _('klienci')
        ordering = ['nazwisko', 'imie']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['telefon']),
            models.Index(fields=['nazwisko', 'imie']),
            models.Index(fields=['liczba_wizyt']),
        ]

    def __str__(self):
        if self.deleted_at:
            return f"[USUNIĘTY] {self.id}"
        return f"{self.imie} {self.nazwisko}"

    def get_full_name(self):
        if self.deleted_at:
            return "[USUNIĘTY]"
        return f"{self.imie} {self.nazwisko}"


# ============================================================================
# RESERVATIONS (Wizyta - Logika walidacji w aplikacji)
# ============================================================================

class Wizyta(UUIDTimestampedModel):
    """Reservation/Visit entity from PDF metody_klasy.pdf."""
    STATUS_CHOICES = [
        ('oczekujaca', _('Oczekująca')),
        ('potwierdzona', _('Potwierdzona')),
        ('w_trakcie', _('W trakcie')),
        ('zrealizowana', _('Zrealizowana')),
        ('odwolana', _('Odwołana')),
        ('no_show', _('No-show')),
    ]

    CHANNEL_CHOICES = [
        ('web', _('Strona WWW')),
        ('telefon', _('Telefon')),
        ('osobiscie', _('Osobiście')),
        ('pracownik', _('Przez pracownika')),
    ]

    klient = models.ForeignKey(
        Klient, on_delete=models.PROTECT, related_name='wizyty', verbose_name=_('klient')
    )
    pracownik = models.ForeignKey(
        Pracownik, on_delete=models.PROTECT, related_name='wizyty', verbose_name=_('pracownik')
    )
    usluga = models.ForeignKey(
        Usluga, on_delete=models.PROTECT, related_name='wizyty', verbose_name=_('usługa')
    )

    status = models.CharField(
        _('status'), max_length=20, choices=STATUS_CHOICES, default='oczekujaca', db_index=True
    )

    termin_start = models.DateTimeField(_('termin start'), db_index=True)
    termin_koniec = models.DateTimeField(_('termin koniec'))

    timespan = DateTimeRangeField(_('zakres czasu'), db_index=True)

    kanal_rezerwacji = models.CharField(
        _('kanał rezerwacji'), max_length=20, choices=CHANNEL_CHOICES, default='web'
    )
    notatki_klienta = models.TextField(_('notatki klienta'), blank=True)
    notatki_wewnetrzne = models.TextField(_('notatki wewnętrzne'), blank=True)

    anulowana_przez = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='anulowane_wizyty',
        verbose_name=_('anulowana przez')
    )
    data_anulowania = models.DateTimeField(_('data anulowania'), null=True, blank=True)
    powod_anulowania = models.TextField(_('powód anulowania'), blank=True)

    przypomnienie_wyslane = models.BooleanField(_('przypomnienie wysłane'), default=False)
    data_wyslania_przypomnienia = models.DateTimeField(
        _('data wysłania przypomnienia'), null=True, blank=True
    )

    class Meta:
        db_table = 'wizyty'
        verbose_name = _('wizyta')
        verbose_name_plural = _('wizyty')
        ordering = ['-termin_start']
        indexes = [
            models.Index(fields=['pracownik', 'termin_start']),
            models.Index(fields=['klient', 'status']),
            models.Index(fields=['status', 'termin_start']),
            models.Index(fields=['usluga', 'status']),
            models.Index(fields=['kanal_rezerwacji']),
        ]
        constraints = [
            CheckConstraint(
                check=Q(termin_koniec__gt=F('termin_start')),
                name='wizyty_end_after_start'
            ),
        ]

    def __str__(self):
        return f"{self.klient.get_full_name()} - {self.usluga.nazwa} ({self.termin_start.strftime('%Y-%m-%d %H:%M')})"

    def clean(self):
        """Walidacja na poziomie aplikacji: Zapobiega nakładaniu się wizyt."""
        from django.core.exceptions import ValidationError

        # 1. Walidacja kolejności dat
        if self.termin_koniec <= self.termin_start:
            raise ValidationError({'termin_koniec': _('Termin końca musi być po terminie startu')})

        # 2. Walidacja nakładania się wizyt (Logika GIST w Pythonie)
        if self.pracownik_id and self.status in ['oczekujaca', 'potwierdzona', 'w_trakcie']:
            overlapping = Wizyta.objects.filter(
                pracownik=self.pracownik,
                status__in=['oczekujaca', 'potwierdzona', 'w_trakcie'],
                termin_start__lt=self.termin_koniec,
                termin_koniec__gt=self.termin_start
            ).exclude(pk=self.pk)

            if overlapping.exists():
                raise ValidationError('Pracownik jest zajęty w podanym terminie. Występuje nakładanie się wizyt.')

    def save(self, *args, **kwargs):
        """Wymuszenie pełnej walidacji i synchronizacja pola timespan."""
        self.full_clean()
        self.timespan = DateTimeTZRange(
            self.termin_start,
            self.termin_koniec,
            bounds='[)'
        )
        super().save(*args, **kwargs)


# ============================================================================
# NOTES, MEDIA, PAYMENTS, INVOICES, NOTIFICATIONS, REPORTS, LOGS, SETTINGS, STATS
# ============================================================================

class Notatka(UUIDTimestampedModel):
    wizyta = models.ForeignKey(Wizyta, on_delete=models.CASCADE, related_name='notatki', verbose_name=_('wizyta'))
    czas = models.DateTimeField(_('czas'), auto_now_add=True)
    tresc = models.TextField(_('treść'))
    autor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='notatki',
                              verbose_name=_('autor'))
    widoczna_dla_klienta = models.BooleanField(_('widoczna dla klienta'), default=False)

    class Meta:
        db_table = 'notatki'
        verbose_name = _('notatka')
        verbose_name_plural = _('notatki')
        ordering = ['-czas']

    def __str__(self):
        return f"Notatka - {self.wizyta} ({self.czas.strftime('%Y-%m-%d %H:%M')})"


class Material(UUIDTimestampedModel):
    TYPE_CHOICES = [
        ('portfolio', _('Portfolio')),
        ('usluga', _('Zdjęcie usługi')),
        ('inne', _('Inne')),
    ]

    typ = models.CharField(_('typ'), max_length=20, choices=TYPE_CHOICES, default='portfolio')
    url = models.CharField(_('URL'), max_length=500)
    opis = models.TextField(_('opis'), blank=True)

    wlasciciel_prac = models.ForeignKey(
        Pracownik, on_delete=models.PROTECT, related_name='materialy', verbose_name=_('właściciel pracownik')
    )

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

    def __str__(self):
        return f"{self.get_typ_display()} - {self.wlasciciel_prac}"


class Platnosc(UUIDTimestampedModel):
    STATUS_CHOICES = [
        ('oczekujaca', _('Oczekująca')),
        ('zaplacona', _('Zapłacona')),
        ('zwrocona', _('Zwrócona')),
        ('przepadla', _('Przepadła')),
    ]

    TYPE_CHOICES = [
        ('zaliczka', _('Zaliczka')),
        ('platnosc_pelna', _('Płatność pełna')),
        ('kara', _('Kara za no-show')),
    ]

    METHOD_CHOICES = [
        ('gotowka', _('Gotówka')),
        ('karta', _('Karta')),
        ('przelew', _('Przelew')),
        ('online', _('Płatność online')),
    ]

    wizyta = models.ForeignKey(
        Wizyta, on_delete=models.PROTECT, related_name='platnosci', verbose_name=_('wizyta'), null=True, blank=True
    )

    kwota = models.DecimalField(
        _('kwota'), max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.00'))]
    )
    status = models.CharField(
        _('status'), max_length=20, choices=STATUS_CHOICES, default='oczekujaca', db_index=True
    )
    typ = models.CharField(
        _('typ'), max_length=20, choices=TYPE_CHOICES, default='platnosc_pelna'
    )

    metoda_platnosci = models.CharField(
        _('metoda płatności'), max_length=20, choices=METHOD_CHOICES, default='gotowka'
    )
    data_platnosci = models.DateTimeField(_('data płatności'), null=True, blank=True, db_index=True)
    reference = models.CharField(_('referencja'), max_length=200, blank=True)

    class Meta:
        db_table = 'platnosci'
        verbose_name = _('płatność')
        verbose_name_plural = _('płatności')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'typ']),
            models.Index(fields=['wizyta']),
            models.Index(fields=['data_platnosci']),
            models.Index(fields=['metoda_platnosci', 'status']),
        ]

    def __str__(self):
        return f"{self.get_typ_display()} {self.kwota} PLN - {self.get_status_display()}"


class Faktura(UUIDTimestampedModel):
    numer = models.CharField(_('numer faktury'), max_length=50, unique=True, db_index=True)

    klient = models.ForeignKey(
        Klient, on_delete=models.PROTECT, related_name='faktury', verbose_name=_('klient')
    )
    wizyta = models.ForeignKey(
        Wizyta, on_delete=models.PROTECT, null=True, blank=True, related_name='faktury', verbose_name=_('wizyta')
    )

    data_wystawienia = models.DateField(_('data wystawienia'), db_index=True)
    data_sprzedazy = models.DateField(_('data sprzedaży'))
    termin_platnosci = models.DateField(_('termin płatności'), null=True, blank=True)

    kwota_netto = models.DecimalField(
        _('kwota netto'), max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.00'))]
    )
    stawka_vat = models.DecimalField(
        _('stawka VAT %'), max_digits=5, decimal_places=2, default=Decimal('23.00')
    )
    kwota_vat = models.DecimalField(
        _('kwota VAT'), max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.00'))]
    )
    kwota_brutto = models.DecimalField(
        _('kwota brutto'), max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))]
    )

    zaplacona = models.BooleanField(_('zapłacona'), default=False, db_index=True)
    data_zaplaty = models.DateField(_('data zapłaty'), null=True, blank=True)

    plik_pdf = models.CharField(_('plik PDF'), max_length=500, blank=True)

    class Meta:
        db_table = 'faktury'
        verbose_name = _('faktura')
        verbose_name_plural = _('faktury')
        ordering = ['-data_wystawienia', '-numer']
        indexes = [
            models.Index(fields=['numer']),
            models.Index(fields=['klient', 'data_wystawienia']),
            models.Index(fields=['zaplacona', 'termin_platnosci']),
        ]

    def __str__(self):
        return f"Faktura {self.numer} - {self.kwota_brutto} PLN"


class Powiadomienie(UUIDTimestampedModel):
    TYPE_CHOICES = [
        ('potwierdzenie', _('Potwierdzenie rezerwacji')),
        ('przypomnienie', _('Przypomnienie o wizycie')),
        ('anulowanie', _('Anulowanie wizyty')),
        ('zmiana', _('Zmiana terminu')),
        ('promocja', _('Promocja')),
    ]

    CHANNEL_CHOICES = [
        ('email', _('Email')),
        ('sms', _('SMS')),
        ('push', _('Push notification')),
    ]

    STATUS_CHOICES = [
        ('oczekujace', _('Oczekujące')),
        ('wyslane', _('Wysłane')),
        ('dostarczone', _('Dostarczone')),
        ('blad', _('Błąd')),
    ]

    typ = models.CharField(_('typ'), max_length=20, choices=TYPE_CHOICES)
    kanal = models.CharField(_('kanał'), max_length=20, choices=CHANNEL_CHOICES)
    status = models.CharField(
        _('status'), max_length=20, choices=STATUS_CHOICES, default='oczekujace', db_index=True
    )

    tresc = models.TextField(_('treść'))
    temat = models.CharField(_('temat'), max_length=200, blank=True)
    termin_wysylki = models.DateTimeField(_('termin wysyłki'), db_index=True)
    data_wyslania = models.DateTimeField(_('data wysłania'), null=True, blank=True)

    klient = models.ForeignKey(
        Klient, on_delete=models.CASCADE, related_name='powiadomienia', verbose_name=_('klient')
    )
    wizyta = models.ForeignKey(
        Wizyta, on_delete=models.CASCADE, null=True, blank=True, related_name='powiadomienia', verbose_name=_('wizyta')
    )

    liczba_prob = models.PositiveIntegerField(_('liczba prób'), default=0)
    komunikat_bledu = models.TextField(_('komunikat błędu'), blank=True)

    class Meta:
        db_table = 'powiadomienia'
        verbose_name = _('powiadomienie')
        verbose_name_plural = _('powiadomienia')
        ordering = ['termin_wysylki']
        indexes = [
            models.Index(fields=['status', 'termin_wysylki']),
            models.Index(fields=['klient', 'typ']),
            models.Index(fields=['wizyta']),
        ]

    def __str__(self):
        return f"{self.get_typ_display()} - {self.klient} ({self.get_status_display()})"


class RaportPDF(UUIDTimestampedModel):
    TYPE_CHOICES = [
        ('lista_wizyt', _('Lista wizyt')),
        ('lista_klientow', _('Lista klientów')),
        ('oblozenie_pracownikow', _('Obłożenie pracowników')),
        ('top_uslugi', _('Najpopularniejsze usługi')),
        ('anulacje_noshow', _('Anulacje i no-show')),
        ('przychod_zaliczek', _('Przychód z zaliczek')),
        ('raport_finansowy', _('Raport finansowy')),
        ('raport_wynikow', _('Raport wyników')),
    ]

    typ = models.CharField(_('typ'), max_length=30, choices=TYPE_CHOICES, db_index=True)
    tytul = models.CharField(_('tytuł'), max_length=200)
    sciezka_pliku = models.CharField(_('ścieżka pliku'), max_length=500)

    data_od = models.DateField(_('data od'), null=True, blank=True)
    data_do = models.DateField(_('data do'), null=True, blank=True)

    parametry = JSONField(
        _('parametry'), default=dict, blank=True, help_text=_('Additional report parameters')
    )

    wygenerowany_przez = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='raporty', verbose_name=_('wygenerowany przez')
    )
    rozmiar_pliku = models.PositiveIntegerField(_('rozmiar pliku (B)'), default=0)

    class Meta:
        db_table = 'raporty'
        verbose_name = _('raport PDF')
        verbose_name_plural = _('raporty PDF')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['typ', 'created_at']),
            models.Index(fields=['data_od', 'data_do']),
            models.Index(fields=['wygenerowany_przez']),
        ]

    def __str__(self):
        return f"{self.get_typ_display()} - {self.tytul} ({self.created_at.strftime('%Y-%m-%d')})"


class LogEntry(UUIDTimestampedModel):
    TYPE_CHOICES = [
        ('rezerwacja', _('Rezerwacja wizyty')),
        ('zmiana_statusu', _('Zmiana statusu wizyty')),
        ('platnosc', _('Płatność')),
        ('dodanie_uslugi', _('Dodanie usługi')),
        ('edycja_uslugi', _('Edycja usługi')),
        ('usuniecie_uslugi', _('Usunięcie usługi')),
        ('edycja_grafiku', _('Edycja grafiku')),
        ('dodanie_materialu', _('Dodanie materiału')),
        ('rejestracja_klienta', _('Rejestracja klienta')),
        ('rejestracja_pracownika', _('Rejestracja pracownika')),
        ('login', _('Logowanie')),
        ('logout', _('Wylogowanie')),
        ('zmiana_ustawien', _('Zmiana ustawień')),
        ('generowanie_raportu', _('Generowanie raportu')),
        ('inne', _('Inne')),
    ]

    LEVEL_CHOICES = [
        ('info', _('Info')),
        ('warning', _('Ostrzeżenie')),
        ('error', _('Błąd')),
        ('critical', _('Krytyczny')),
    ]

    czas = models.DateTimeField(_('czas'), auto_now_add=True, db_index=True)
    typ = models.CharField(_('typ'), max_length=30, choices=TYPE_CHOICES, db_index=True)
    poziom = models.CharField(
        _('poziom'), max_length=20, choices=LEVEL_CHOICES, default='info'
    )
    opis = models.TextField(_('opis'))

    uzytkownik = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='log_entries', verbose_name=_('użytkownik')
    )

    adres_ip = models.GenericIPAddressField(_('adres IP'), null=True, blank=True)
    user_agent = models.CharField(_('user agent'), max_length=500, blank=True)

    entity_type = models.CharField(_('typ encji'), max_length=50, blank=True)
    entity_id = models.UUIDField(_('ID encji'), null=True, blank=True)

    metadata = JSONField(_('metadane'), default=dict, blank=True)

    class Meta:
        db_table = 'logi'
        verbose_name = _('log entry')
        verbose_name_plural = _('log entries')
        ordering = ['-czas']
        indexes = [
            models.Index(fields=['czas']),
            models.Index(fields=['typ', 'czas']),
            models.Index(fields=['uzytkownik', 'czas']),
            models.Index(fields=['poziom', 'czas']),
            models.Index(fields=['entity_type', 'entity_id']),
        ]

    def __str__(self):
        user_str = self.uzytkownik.email if self.uzytkownik else 'System'
        return f"{self.get_typ_display()} - {user_str} ({self.czas.strftime('%Y-%m-%d %H:%M')})"


class UstawieniaSystemowe(UUIDTimestampedModel):
    slot_minuty = models.PositiveIntegerField(
        _('slot minuty'), default=30, validators=[MinValueValidator(5), MaxValueValidator(120)],
        help_text=_('Długość slotu czasowego (5-120 minut)')
    )

    bufor_minuty = models.PositiveIntegerField(
        _('bufor minuty'), default=0, validators=[MaxValueValidator(60)],
        help_text=_('Bufor między wizytami (0-60 minut)')
    )

    polityka_zaliczek = JSONField(
        _('polityka zaliczek'), default=dict,
        help_text=_('Format: {"wymagana": true, "procent": 20, "godziny_anulowania": 24}')
    )

    harmonogram_powiadomien = JSONField(
        _('harmonogram powiadomień'), default=dict,
        help_text=_('Format: {"potwierdzenie": "natychmiast", "przypomnienie_godziny": 24}')
    )

    godziny_otwarcia = JSONField(
        _('godziny otwarcia'), default=dict,
        help_text=_('Format: {"poniedzialek": {"start": "09:00", "end": "18:00"}, ...}')
    )

    nazwa_salonu = models.CharField(_('nazwa salonu'), max_length=200, default='Beauty Salon')
    adres = models.CharField(_('adres'), max_length=300, blank=True)
    telefon = models.CharField(_('telefon'), max_length=20, blank=True)
    email_kontaktowy = models.EmailField(_('email kontaktowy'), blank=True)

    stawka_vat_domyslna = models.DecimalField(
        _('stawka VAT domyślna %'), max_digits=5, decimal_places=2, default=Decimal('23.00')
    )

    tryb_konserwacji = models.BooleanField(_('tryb konserwacji'), default=False)
    komunikat_konserwacji = models.TextField(_('komunikat konserwacji'), blank=True)

    ostatnia_modyfikacja_przez = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='modyfikacje_ustawien',
        verbose_name=_('ostatnia modyfikacja przez')
    )

    class Meta:
        db_table = 'ustawienia'
        verbose_name = _('ustawienia systemowe')
        verbose_name_plural = _('ustawienia systemowe')

    def __str__(self):
        return f"{self.nazwa_salonu} - Ustawienia (slot: {self.slot_minuty}min)"

    def save(self, *args, **kwargs):
        # Enforce singleton pattern
        if not self.pk:
            existing = UstawieniaSystemowe.objects.first()
            if existing:
                self.pk = existing.pk
        super().save(*args, **kwargs)
        if self.pk:
            UstawieniaSystemowe.objects.exclude(pk=self.pk).delete()


class StatystykaSnapshot(UUIDTimestampedModel):
    PERIOD_CHOICES = [
        ('dzienny', _('Dzienny')),
        ('tygodniowy', _('Tygodniowy')),
        ('miesieczny', _('Miesięczny')),
    ]

    okres = models.CharField(_('okres'), max_length=20, choices=PERIOD_CHOICES)
    data_od = models.DateField(_('data od'), db_index=True)
    data_do = models.DateField(_('data do'))

    liczba_wizyt_total = models.PositiveIntegerField(_('liczba wizyt (total)'), default=0)
    liczba_wizyt_zrealizowanych = models.PositiveIntegerField(_('liczba wizyt zrealizowanych'), default=0)
    liczba_anulacji = models.PositiveIntegerField(_('liczba anulacji'), default=0)
    liczba_noshow = models.PositiveIntegerField(_('liczba no-show'), default=0)

    przychod_total = models.DecimalField(
        _('przychód total'), max_digits=12, decimal_places=2, default=Decimal('0.00')
    )
    przychod_zaliczek = models.DecimalField(
        _('przychód z zaliczek'), max_digits=12, decimal_places=2, default=Decimal('0.00')
    )

    liczba_nowych_klientow = models.PositiveIntegerField(_('liczba nowych klientów'), default=0)
    liczba_powracajacych_klientow = models.PositiveIntegerField(_('liczba powracających klientów'), default=0)

    srednie_oblozenie_pracownikow = models.DecimalField(
        _('średnie obłożenie pracowników %'), max_digits=5, decimal_places=2, default=Decimal('0.00')
    )

    dodatkowe_metryki = JSONField(_('dodatkowe metryki'), default=dict, blank=True)

    class Meta:
        db_table = 'statystyki_snapshots'
        verbose_name = _('statystyka snapshot')
        verbose_name_plural = _('statystyki snapshots')
        ordering = ['-data_od']
        indexes = [
            models.Index(fields=['okres', 'data_od']),
        ]
        unique_together = [['okres', 'data_od']]

    def __str__(self):
        return f"Statystyki {self.get_okres_display()} - {self.data_od}"


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_employee_number():
    """Generate next employee number (EMP-0001, EMP-0002, etc.)."""
    last_emp = Pracownik.objects.order_by('-nr').first()
    if not last_emp:
        return 'EMP-0001'

    try:
        last_num = int(last_emp.nr.split('-')[1])
        return f'EMP-{last_num + 1:04d}'
    except (IndexError, ValueError):
        return 'EMP-0001'


def generate_invoice_number(date=None):
    """Generate invoice number (FV/YEAR/MONTH/SEQUENCE)."""
    if date is None:
        date = timezone.now().date()

    year = date.year
    month = date.month

    prefix = f'FV/{year}/{month:02d}/'
    last_invoice = Faktura.objects.filter(
        numer__startswith=prefix
    ).order_by('-numer').first()

    if not last_invoice:
        return f'{prefix}0001'

    try:
        last_num = int(last_invoice.numer.split('/')[-1])
        return f'{prefix}{last_num + 1:04d}'
    except (IndexError, ValueError):
        return f'{prefix}0001'


def calculate_vat(kwota_netto, stawka_vat):
    """Calculate VAT amount from net amount and rate with validation."""
    from decimal import Decimal, InvalidOperation

    try:
        if not isinstance(kwota_netto, Decimal):
            kwota_netto = Decimal(str(kwota_netto))
        if not isinstance(stawka_vat, Decimal):
            stawka_vat = Decimal(str(stawka_vat))
    except (ValueError, InvalidOperation):
        raise ValueError("Nieprawidłowe dane wejściowe dla obliczeń VAT.")

    if kwota_netto < 0:
        raise ValueError("Kwota nie może być ujemna.")
    if not (Decimal('0.00') <= stawka_vat <= Decimal('100.00')):
        raise ValueError("Stawka VAT musi być w zakresie 0-100%.")

    vat_amount = (kwota_netto * stawka_vat / Decimal('100')).quantize(Decimal('0.01'))
    gross_amount = kwota_netto + vat_amount
    return vat_amount, gross_amount


def get_available_time_slots(pracownik, data, _usluga):
    """Calculate available time slots for employee on given date."""

    settings = UstawieniaSystemowe.objects.first()
    if not settings:
        return []

    _slot_duration = timedelta(minutes=settings.slot_minuty)
    _buffer_duration = timedelta(minutes=settings.bufor_minuty)

    grafik = Grafik.objects.filter(
        pracownik=pracownik,
        status='aktywny'
    ).first()

    if not grafik:
        return []

    _existing = Wizyta.objects.filter(
        pracownik=pracownik,
        termin_start__date=data,
        status__in=['oczekujaca', 'potwierdzona', 'w_trakcie']
    ).order_by('termin_start')

    available_slots = []

    return available_slots