"""
Beauty Salon Management System - Django Admin
Autor: Dominika Jedynak, nr albumu: 92721

Wersja: OSTATECZNA - Profesjonalny panel administracyjny, ZAKTUALIZOWANY:
1. Poprawne importy helperów z utils.py.
2. Usunięto pole 'urlopy' z GrafikAdmin.
3. Zastąpiono pole 'czas' polem 'created_at' w NotatkaAdmin i NotatkaInline.
"""

import csv
from decimal import Decimal
from datetime import timedelta
from typing import TYPE_CHECKING, Optional

from django.contrib import admin
from django.contrib.admin import SimpleListFilter
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db.models import Sum, Q, QuerySet
from django.http import HttpResponse
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

# ============================================================================
# 1. POPRAWIONE IMPORTY PO REFAKTORYZACJI
# ============================================================================
from .models import (
    User, Usluga, Pracownik, Grafik, Urlop, Klient,
    Wizyta, Notatka, Material, Platnosc, Faktura,
    Powiadomienie, RaportPDF, LogEntry, UstawieniaSystemowe,
    StatystykaSnapshot
)
# generate_invoice_number i calculate_vat zostały przeniesione do utils.py
from .utils import generate_invoice_number, calculate_vat

if TYPE_CHECKING:
    from .models import User as UserModel


# ============================================================================
# DEFINICJE AKCJI
# ============================================================================

def export_to_csv(modeladmin, request, queryset: QuerySet):
    """Uniwersalna akcja eksportu do CSV."""
    opts = modeladmin.model._meta
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename={opts.verbose_name_plural}.csv'

    writer = csv.writer(response)
    fields = [field for field in opts.get_fields() if not field.many_to_many and not field.one_to_many]

    writer.writerow([field.verbose_name for field in fields])

    for obj in queryset:
        row = []
        for field in fields:
            value = getattr(obj, field.name)
            if callable(value):
                value = value()
            row.append(value)
        writer.writerow(row)

    return response


export_to_csv.short_description = "Eksportuj do CSV"


def send_reminder_notifications(modeladmin, request, queryset: QuerySet):
    """Wyślij przypomnienia dla wybranych wizyt."""
    count = 0
    for wizyta in queryset.filter(
            status__in=['oczekujaca', 'potwierdzona'],
            przypomnienie_wyslane=False,
            termin_start__gte=timezone.now()
    ):
        wizyta.przypomnienie_wyslane = True
        wizyta.data_wyslania_przypomnienia = timezone.now()
        wizyta.save()
        count += 1

    modeladmin.message_user(request, format_html('Wysłano przypomnienia dla {} wizyt.', count))


send_reminder_notifications.short_description = 'Wyślij przypomnienia'


def generate_invoices(modeladmin, request, queryset: QuerySet):
    """Generuj faktury dla wybranych wizyt."""
    count = 0
    ustawienia = UstawieniaSystemowe.load()
    stawka_vat = ustawienia.stawka_vat_domyslna if ustawienia else Decimal('23.00')

    for wizyta in queryset.filter(status='zrealizowana'):
        if wizyta.faktury.exists():
            continue
        if not wizyta.usluga:
            continue

        kwota_netto = wizyta.usluga.cena
        kwota_vat, kwota_brutto = calculate_vat(kwota_netto, stawka_vat)

        Faktura.objects.create(
            numer=generate_invoice_number(),
            klient=wizyta.klient,
            wizyta=wizyta,
            data_wystawienia=timezone.now().date(),
            data_sprzedazy=wizyta.termin_start.date(),
            termin_platnosci=timezone.now().date() + timedelta(days=14),
            kwota_netto=kwota_netto,
            stawka_vat=stawka_vat,
            kwota_vat=kwota_vat,
            kwota_brutto=kwota_brutto,
            zaplacona=False
        )
        count += 1

    modeladmin.message_user(request, format_html('Wygenerowano {} faktur.', count))


generate_invoices.short_description = 'Generuj faktury'


# ============================================================================
# INLINE DEFINITIONS
# ============================================================================

class PracownikInline(admin.StackedInline):
    model = Pracownik
    can_delete = False
    verbose_name_plural = _('Profil Pracownika')
    fk_name = 'user'
    fields = (
        ('nr', 'aktywny', 'data_zatrudnienia'),
        ('imie', 'nazwisko', 'telefon'),
        'kompetencje',
        ('liczba_wizyt', 'srednia_ocena'),
    )
    readonly_fields = ('liczba_wizyt', 'srednia_ocena',)
    raw_id_fields = ['kompetencje']


class KlientInline(admin.StackedInline):
    model = Klient
    can_delete = False
    verbose_name_plural = _('Profil Klienta')
    fk_name = 'user'
    fields = (
        ('nr', 'imie', 'nazwisko', 'email', 'telefon'),
        ('liczba_wizyt', 'laczna_wydana_kwota'),
        ('zgoda_marketing', 'preferowany_kontakt'),
        'notatki_wewnetrzne',
        ('deleted_at',)
    )
    readonly_fields = ('deleted_at', 'liczba_wizyt', 'laczna_wydana_kwota',)


class GrafikInline(admin.TabularInline):
    model = Grafik
    extra = 0
    fields = ['status', 'created_at']
    readonly_fields = ['created_at']
    can_delete = False


# 3a. POPRAWKA NOTATKA INLINE: czas -> created_at
class NotatkaInline(admin.TabularInline):
    model = Notatka
    extra = 0
    fields = ['tresc', 'autor', 'widoczna_dla_klienta', 'created_at']
    readonly_fields = ['created_at', 'autor']
    show_change_link = True
    raw_id_fields = ['autor']


class PlatnoscInline(admin.TabularInline):
    model = Platnosc
    extra = 0
    fields = ['typ', 'kwota', 'status', 'metoda_platnosci', 'data_platnosci']
    readonly_fields = ['created_at']
    show_change_link = True


# ============================================================================
# CUSTOM FILTERS
# ============================================================================

class TodayAppointmentsFilter(SimpleListFilter):
    title = 'dzisiejsze wizyty'
    parameter_name = 'today'

    def lookups(self, request, model_admin):
        return (('yes', 'Dzisiaj'), ('tomorrow', 'Jutro'), ('week', 'Ten tydzień'))

    def queryset(self, request, queryset):
        today = timezone.now().date()
        if self.value() == 'yes':
            return queryset.filter(termin_start__date=today)
        elif self.value() == 'tomorrow':
            tomorrow = today + timedelta(days=1)
            return queryset.filter(termin_start__date=tomorrow)
        elif self.value() == 'week':
            week_end = today + timedelta(days=7)
            return queryset.filter(termin_start__date__gte=today, termin_start__date__lte=week_end)
        return queryset


class RevenueRangeFilter(SimpleListFilter):
    title = 'zakres wydatków'
    parameter_name = 'revenue'

    def lookups(self, request, model_admin):
        return (
            ('0-500', '0 - 500 PLN'),
            ('500-1000', '500 - 1000 PLN'),
            ('1000-5000', '1000 - 5000 PLN'),
            ('5000+', 'Powyżej 5000 PLN'),
        )

    def queryset(self, request, queryset):
        if self.value() == '0-500':
            return queryset.filter(laczna_wydana_kwota__gte=0, laczna_wydana_kwota__lt=500)
        elif self.value() == '500-1000':
            return queryset.filter(laczna_wydana_kwota__gte=500, laczna_wydana_kwota__lt=1000)
        elif self.value() == '1000-5000':
            return queryset.filter(laczna_wydana_kwota__gte=1000, laczna_wydana_kwota__lt=5000)
        elif self.value() == '5000+':
            return queryset.filter(laczna_wydana_kwota__gte=5000)
        return queryset


# ============================================================================
# ADMIN CLASSES
# ============================================================================

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin dla custom User model."""
    list_display = ['email', 'role', 'is_active', 'is_staff', 'last_login',
                    'failed_login_attempts', 'account_status']
    list_filter = ['role', 'is_active', 'is_staff', 'is_superuser', 'created_at']
    search_fields = ['email']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at', 'last_login']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Role & Permissions'), {
            'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        (_('Security'), {
            'fields': ('last_login', 'last_login_ip', 'failed_login_attempts', 'account_locked_until'),
            'classes': ('collapse',),
        }),
        (_('Timestamps'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'role', 'is_active', 'is_staff'),
        }),
    )

    def account_status(self, obj: 'UserModel'):
        locked_until_str = obj.account_locked_until.strftime('%Y-%m-%d %H:%M') if obj.account_locked_until else ''
        if obj.account_locked_until and obj.account_locked_until > timezone.now():
            return format_html(
                '<span style="color: red; font-weight: bold;">Zablokowane do {}</span>',
                locked_until_str
            )
        elif obj.failed_login_attempts >= 3:
            return format_html(
                '<span style="color: orange;">{} nieudanych prób</span>',
                obj.failed_login_attempts
            )
        elif obj.is_active:
            return format_html('<span style="color: green;">{}</span>', 'Aktywne')
        else:
            return format_html('<span style="color: gray;">{}</span>', 'Nieaktywne')

    account_status.short_description = 'Status konta'

    def get_inline_instances(self, request, obj: Optional['UserModel'] = None):
        if obj is None:
            return []

        inlines = []
        is_superuser = getattr(obj, 'is_superuser', False)

        if obj.role == 'employee' or is_superuser:
            if hasattr(obj, 'pracownik') or is_superuser:
                inlines.append(PracownikInline)

        if obj.role == 'client' or is_superuser:
            if hasattr(obj, 'klient') or is_superuser:
                inlines.append(KlientInline)

        if is_superuser:
            if obj.role == 'employee' and not hasattr(obj, 'pracownik'):
                inlines.append(PracownikInline)
            if obj.role == 'client' and not hasattr(obj, 'klient'):
                inlines.append(KlientInline)

        return inlines


@admin.register(Usluga)
class UslugaAdmin(admin.ModelAdmin):
    list_display = ['nazwa', 'kategoria', 'cena_display', 'czas_trwania',
                    'publikowana', 'liczba_rezerwacji', 'promocja_status']
    list_filter = ['kategoria', 'publikowana', 'created_at']
    search_fields = ['nazwa', 'kategoria', 'opis']
    ordering = ['kategoria', 'nazwa']
    readonly_fields = ['liczba_rezerwacji']
    actions = ['publikuj_uslugi', 'ukryj_uslugi']
    fieldsets = (
        (_('Podstawowe informacje'), {
            'fields': ('nazwa', 'kategoria', 'opis', 'zdjecie_url'),
        }),
        (_('Cena i czas'), {
            'fields': ('cena', 'czas_trwania', 'promocja'),
        }),
        (_('Publikacja'), {
            'fields': ('publikowana',),
        }),
        (_('Statystyki'), {
            'fields': ('liczba_rezerwacji',),
            'classes': ('collapse',),
        }),
    )

    def cena_display(self, obj):
        if obj.promocja and obj.promocja.get('active'):
            promo_price = obj.get_price_with_promotion()
            return format_html(
                '<span style="text-decoration: line-through;">{} PLN</span> '
                '<span style="color: red; font-weight: bold;">{} PLN</span>',
                obj.cena, promo_price
            )
        return format_html("{} PLN", obj.cena)

    cena_display.short_description = 'Cena'

    def promocja_status(self, obj):
        if obj.promocja and obj.promocja.get('active'):
            discount = obj.promocja.get('discount_percent', 0)
            return format_html(
                '<span style="background-color: #ff4444; color: white; padding: 2px 8px; '
                'border-radius: 3px;">-{}%</span>',
                discount
            )
        return format_html("{}", '-')

    promocja_status.short_description = 'Promocja'

    def publikuj_uslugi(self, request, queryset: QuerySet):
        updated = queryset.update(publikowana=True)
        self.message_user(request, format_html('Opublikowano {} usług.', updated))

    publikuj_uslugi.short_description = 'Publikuj wybrane usługi'

    def ukryj_uslugi(self, request, queryset: QuerySet):
        updated = queryset.update(publikowana=False)
        self.message_user(request, format_html('Ukryto {} usług.', updated))

    ukryj_uslugi.short_description = 'Ukryj wybrane usługi'


@admin.register(Pracownik)
class PracownikAdmin(admin.ModelAdmin):
    list_display = ['nr', 'get_full_name', 'user', 'aktywny', 'liczba_wizyt',
                    'srednia_ocena', 'data_zatrudnienia']
    list_filter = ['aktywny', 'data_zatrudnienia']
    search_fields = ['nr', 'imie', 'nazwisko', 'user__email']
    ordering = ['nazwisko', 'imie']
    readonly_fields = ['liczba_wizyt', 'srednia_ocena']
    filter_horizontal = ['kompetencje']
    inlines = [GrafikInline]
    raw_id_fields = ['user']
    fieldsets = (
        (_('Dane osobowe'), {
            'fields': ('nr', 'imie', 'nazwisko', 'user', 'telefon'),
        }),
        (_('Zatrudnienie'), {
            'fields': ('data_zatrudnienia', 'aktywny'),
        }),
        (_('Kompetencje'), {
            'fields': ('kompetencje',),
        }),
        (_('Statystyki'), {
            'fields': ('liczba_wizyt', 'srednia_ocena'),
            'classes': ('collapse',),
        }),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user').prefetch_related('kompetencje')


@admin.register(Grafik)
class GrafikAdmin(admin.ModelAdmin):
    list_display = ['pracownik', 'status', 'created_at', 'liczba_dostepnych_dni']
    list_filter = ['status', 'created_at']
    search_fields = ['pracownik__imie', 'pracownik__nazwisko', 'pracownik__nr']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['pracownik']
    fieldsets = (
        (_('Pracownik'), {
            'fields': ('pracownik', 'status'),
        }),
        # 2. POPRAWKA GRAFIK: Usunięcie nieistniejącego pola 'urlopy'
        (_('Harmonogram'), {
            'fields': ('okresy_dostepnosci', 'przerwy'),
        }),
        (_('Timestamps'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def liczba_dostepnych_dni(self, obj):
        return format_html("{}", len(obj.okresy_dostepnosci))

    liczba_dostepnych_dni.short_description = 'Dni w tygodniu'


@admin.register(Urlop)
class UrlopAdmin(admin.ModelAdmin):
    list_display = ['pracownik', 'typ', 'data_od', 'data_do', 'status',
                    'liczba_dni', 'zatwierdzony_przez']
    list_filter = ['status', 'typ', 'data_od']
    search_fields = ['pracownik__imie', 'pracownik__nazwisko', 'powod']
    ordering = ['-data_od']
    readonly_fields = ['data_zatwierdzenia']
    raw_id_fields = ['pracownik', 'zatwierdzony_przez']
    actions = ['zatwierdz_urlopy', 'odrzuc_urlopy']
    fieldsets = (
        (_('Pracownik'), {
            'fields': ('pracownik', 'typ'),
        }),
        (_('Okres'), {
            'fields': ('data_od', 'data_do', 'powod'),
        }),
        (_('Zatwierdzenie'), {
            'fields': ('status', 'zatwierdzony_przez', 'data_zatwierdzenia'),
        }),
    )

    def liczba_dni(self, obj):
        days = (obj.data_do - obj.data_od).days + 1
        return format_html("{}", days)

    liczba_dni.short_description = 'Liczba dni'

    def zatwierdz_urlopy(self, request, queryset: QuerySet):
        for urlop in queryset:
            urlop.status = 'zatwierdzony'
            urlop.zatwierdzony_przez = request.user
            urlop.data_zatwierdzenia = timezone.now()
            urlop.save()
        self.message_user(request, format_html('Zatwierdzono {} urlopów.', queryset.count()))

    zatwierdz_urlopy.short_description = 'Zatwierdź wybrane urlopy'

    def odrzuc_urlopy(self, request, queryset: QuerySet):
        updated = queryset.update(status='odrzucony')
        self.message_user(request, format_html('Odrzucono {} urlopów.', updated))

    odrzuc_urlopy.short_description = 'Odrzuć wybrane urlopy'


@admin.register(Klient)
class KlientAdmin(admin.ModelAdmin):
    list_display = ['nr', 'get_full_name', 'email', 'telefon', 'liczba_wizyt',
                    'laczna_wydana_kwota', 'zgoda_marketing', 'deleted_status']
    list_filter = ['zgoda_marketing', 'preferowany_kontakt', 'deleted_at', RevenueRangeFilter]
    search_fields = ['nr', 'imie', 'nazwisko', 'email', 'telefon']
    ordering = ['nazwisko', 'imie']
    readonly_fields = ['liczba_wizyt', 'laczna_wydana_kwota', 'deleted_at']
    raw_id_fields = ['user']
    actions = [export_to_csv]
    fieldsets = (
        (_('Dane osobowe'), {
            'fields': ('nr', 'imie', 'nazwisko', 'email', 'telefon', 'user'),
        }),
        (_('Marketing'), {
            'fields': ('zgoda_marketing', 'preferowany_kontakt'),
        }),
        (_('Statystyki'), {
            'fields': ('liczba_wizyt', 'laczna_wydana_kwota'),
            'classes': ('collapse',),
        }),
        (_('Notatki'), {
            'fields': ('notatki_wewnetrzne',),
            'classes': ('collapse',),
        }),
        (_('GDPR'), {
            'fields': ('deleted_at',),
            'classes': ('collapse',),
        }),
    )

    def deleted_status(self, obj):
        if obj.deleted_at:
            return format_html(
                '<span style="color: red;">Usunięty {}</span>',
                obj.deleted_at.strftime('%Y-%m-%d')
            )
        return format_html('<span style="color: green;">{}</span>', 'Aktywny')

    deleted_status.short_description = 'Status GDPR'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user')


@admin.register(Wizyta)
class WizytaAdmin(admin.ModelAdmin):
    list_display = ['id_short', 'klient', 'pracownik', 'usluga', 'termin_start',
                    'status', 'kanal_rezerwacji', 'przypomnienie_status']
    list_filter = ['status', 'kanal_rezerwacji', 'termin_start', 'przypomnienie_wyslane', TodayAppointmentsFilter]
    search_fields = ['klient__imie', 'klient__nazwisko', 'pracownik__imie',
                     'pracownik__nazwisko', 'usluga__nazwa']
    ordering = ['-termin_start']
    date_hierarchy = 'termin_start'
    readonly_fields = ['timespan', 'data_anulowania']
    inlines = [NotatkaInline, PlatnoscInline]
    raw_id_fields = ['klient', 'pracownik', 'usluga', 'anulowana_przez']
    actions = ['potwierdz_wizyty', 'anuluj_wizyty', 'oznacz_jako_no_show',
               send_reminder_notifications, generate_invoices, export_to_csv]
    fieldsets = (
        (_('Podstawowe informacje'), {
            'fields': ('klient', 'pracownik', 'usluga', 'status'),
        }),
        (_('Termin'), {
            'fields': ('termin_start', 'termin_koniec'),
        }),
        (_('Szczegóły rezerwacji'), {
            'fields': ('kanal_rezerwacji', 'notatki_klienta', 'notatki_wewnetrzne'),
        }),
        (_('Anulowanie'), {
            'fields': ('anulowana_przez', 'data_anulowania', 'powod_anulowania'),
            'classes': ('collapse',),
        }),
        (_('Przypomnienia'), {
            'fields': ('przypomnienie_wyslane', 'data_wyslania_przypomnienia'),
            'classes': ('collapse',),
        }),
    )

    def id_short(self, obj):
        return format_html("{}", str(obj.id)[:8])

    id_short.short_description = 'ID'

    def przypomnienie_status(self, obj):
        date_str = obj.data_wyslania_przypomnienia.strftime('%Y-%m-%d') if obj.data_wyslania_przypomnienia else ''
        if obj.przypomnienie_wyslane:
            return format_html(
                '<span style="color: green;">Wysłane {}</span>',
                date_str
            )
        return format_html('<span style="color: gray;">{}</span>', 'Niewysłane')

    przypomnienie_status.short_description = 'Przypomnienie'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('klient', 'pracownik', 'usluga', 'anulowana_przez')

    def potwierdz_wizyty(self, request, queryset: QuerySet):
        updated = queryset.filter(status='oczekujaca').update(status='potwierdzona')
        self.message_user(request, format_html('Potwierdzono {} wizyt.', updated))

    potwierdz_wizyty.short_description = 'Potwierdź wybrane wizyty'

    def anuluj_wizyty(self, request, queryset: QuerySet):
        for wizyta in queryset:
            wizyta.status = 'odwolana'
            wizyta.anulowana_przez = request.user
            wizyta.data_anulowania = timezone.now()
            wizyta.save()
        self.message_user(request, format_html('Anulowano {} wizyt.', queryset.count()))

    anuluj_wizyty.short_description = 'Anuluj wybrane wizyty'

    def oznacz_jako_no_show(self, request, queryset: QuerySet):
        updated = queryset.update(status='no_show')
        self.message_user(request, format_html('Oznaczono {} wizyt jako no-show.', updated))

    oznacz_jako_no_show.short_description = 'Oznacz jako no-show'


@admin.register(Platnosc)
class PlatnoscAdmin(admin.ModelAdmin):
    list_display = ['id_short', 'wizyta_link', 'typ', 'kwota', 'status',
                    'metoda_platnosci', 'data_platnosci']
    list_filter = ['status', 'typ', 'metoda_platnosci', 'data_platnosci']
    search_fields = ['wizyta__klient__imie', 'wizyta__klient__nazwisko', 'reference']
    ordering = ['-created_at']
    date_hierarchy = 'data_platnosci'
    readonly_fields = ['created_at']
    raw_id_fields = ['wizyta']
    actions = ['oznacz_jako_zaplacone', export_to_csv]
    fieldsets = (
        (_('Płatność'), {
            'fields': ('wizyta', 'kwota', 'typ', 'status'),
        }),
        (_('Szczegóły'), {
            'fields': ('metoda_platnosci', 'data_platnosci', 'reference'),
        }),
    )

    def id_short(self, obj):
        return format_html("{}", str(obj.id)[:8])

    id_short.short_description = 'ID'

    def wizyta_link(self, obj):
        if obj.wizyta:
            url = reverse('admin:{}_{}_change'.format(obj.wizyta._meta.app_label, obj.wizyta._meta.model_name),
                          args=[obj.wizyta.id])
            return format_html('<a href="{}">Wizyta #{}</a>', url, str(obj.wizyta.id)[:8])
        return format_html("{}", '-')

    wizyta_link.short_description = 'Wizyta'

    def oznacz_jako_zaplacone(self, request, queryset: QuerySet):
        updated = queryset.update(status='zaplacona', data_platnosci=timezone.now())
        self.message_user(request, format_html('Oznaczono {} płatności jako zapłacone.', updated))

    oznacz_jako_zaplacone.short_description = 'Oznacz jako zapłacone'


@admin.register(Faktura)
class FakturaAdmin(admin.ModelAdmin):
    list_display = ['numer', 'klient', 'data_wystawienia', 'kwota_brutto',
                    'zaplacona', 'termin_platnosci', 'status_platnosci']
    list_filter = ['zaplacona', 'data_wystawienia', 'termin_platnosci']
    search_fields = ['numer', 'klient__imie', 'klient__nazwisko']
    ordering = ['-data_wystawienia']
    date_hierarchy = 'data_wystawienia'
    readonly_fields = ['created_at']
    raw_id_fields = ['klient', 'wizyta']
    fieldsets = (
        (_('Faktura'), {
            'fields': ('numer', 'klient', 'wizyta'),
        }),
        (_('Daty'), {
            'fields': ('data_wystawienia', 'data_sprzedazy', 'termin_platnosci'),
        }),
        (_('Kwoty'), {
            'fields': ('kwota_netto', 'stawka_vat', 'kwota_vat', 'kwota_brutto'),
        }),
        (_('Płatność'), {
            'fields': ('zaplacona', 'data_zaplaty'),
        }),
        (_('Plik'), {
            'fields': ('plik_pdf',),
            'classes': ('collapse',),
        }),
    )

    def status_platnosci(self, obj):
        if obj.zaplacona:
            return format_html('<span style="color: green; font-weight: bold;">{}</span>', 'Zapłacona')
        elif obj.termin_platnosci and obj.termin_platnosci < timezone.now().date():
            return format_html('<span style="color: red; font-weight: bold;">{}</span>', 'Przeterminowana')
        else:
            return format_html('<span style="color: orange;">{}</span>', 'Oczekująca')

    status_platnosci.short_description = 'Status'


@admin.register(Powiadomienie)
class PowiadomienieAdmin(admin.ModelAdmin):
    list_display = ['id_short', 'klient', 'typ', 'kanal', 'status',
                    'termin_wysylki', 'liczba_prob']
    list_filter = ['typ', 'kanal', 'status', 'termin_wysylki']
    search_fields = ['klient__imie', 'klient__nazwisko', 'tresc']
    ordering = ['termin_wysylki']
    date_hierarchy = 'termin_wysylki'
    readonly_fields = ['data_wyslania', 'liczba_prob']
    raw_id_fields = ['klient', 'wizyta']
    fieldsets = (
        (_('Powiadomienie'), {
            'fields': ('klient', 'wizyta', 'typ', 'kanal'),
        }),
        (_('Treść'), {
            'fields': ('temat', 'tresc'),
        }),
        (_('Wysyłka'), {
            'fields': ('termin_wysylki', 'status', 'data_wyslania', 'liczba_prob', 'komunikat_bledu'),
        }),
    )

    def id_short(self, obj):
        return format_html("{}", str(obj.id)[:8])

    id_short.short_description = 'ID'


@admin.register(RaportPDF)
class RaportPDFAdmin(admin.ModelAdmin):
    list_display = ['id_short', 'typ', 'tytul', 'data_od', 'data_do',
                    'wygenerowany_przez', 'created_at', 'rozmiar_display']
    list_filter = ['typ', 'created_at']
    search_fields = ['tytul', 'wygenerowany_przez__email']
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at', 'wygenerowany_przez']
    raw_id_fields = ['wygenerowany_przez']
    fieldsets = (
        (_('Raport'), {
            'fields': ('typ', 'tytul', 'sciezka_pliku'),
        }),
        (_('Zakres'), {
            'fields': ('data_od', 'data_do', 'parametry'),
        }),
        (_('Metadata'), {
            'fields': ('wygenerowany_przez', 'rozmiar_pliku', 'created_at'),
        }),
    )

    def id_short(self, obj):
        return format_html("{}", str(obj.id)[:8])

    id_short.short_description = 'ID'

    def rozmiar_display(self, obj):
        """Poprawiono błąd składni i format_html."""
        if not obj.rozmiar_pliku:
            return format_html("{}", '-')
        if obj.rozmiar_pliku < 1024:
            return format_html("{} B", obj.rozmiar_pliku)
        elif obj.rozmiar_pliku < 1024 * 1024:
            return format_html("{:.1f} KB", obj.rozmiar_pliku / 1024)
        else:
            return format_html("{:.1f} MB", obj.rozmiar_pliku / (1024 * 1024))

    rozmiar_display.short_description = 'Rozmiar'


@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    list_display = ['czas', 'typ', 'poziom', 'uzytkownik', 'opis_short',
                    'entity_display', 'adres_ip']
    list_filter = ['typ', 'poziom', 'czas']
    search_fields = ['opis', 'uzytkownik__email', 'adres_ip']
    ordering = ['-czas']
    date_hierarchy = 'czas'
    readonly_fields = ['czas']
    raw_id_fields = ['uzytkownik']
    fieldsets = (
        (_('Log'), {
            'fields': ('czas', 'typ', 'poziom', 'opis'),
        }),
        (_('Użytkownik'), {
            'fields': ('uzytkownik', 'adres_ip', 'user_agent'),
        }),
        (_('Encja'), {
            'fields': ('entity_type', 'entity_id'),
            'classes': ('collapse',),
        }),
        (_('Metadata'), {
            'fields': ('metadata',),
            'classes': ('collapse',),
        }),
    )

    def opis_short(self, obj):
        short_opis = obj.opis[:50] + '...' if len(obj.opis) > 50 else obj.opis
        return format_html("{}", short_opis)

    opis_short.short_description = 'Opis'

    def entity_display(self, obj):
        if obj.entity_type and obj.entity_id:
            return format_html("{} ({})", obj.entity_type, str(obj.entity_id)[:8])
        return format_html("{}", '-')

    entity_display.short_description = 'Encja'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(UstawieniaSystemowe)
class UstawieniaSystemoweAdmin(admin.ModelAdmin):
    list_display = ['nazwa_salonu', 'slot_minuty', 'bufor_minuty',
                    'tryb_konserwacji', 'ostatnia_modyfikacja_przez']
    readonly_fields = ['created_at', 'updated_at', 'ostatnia_modyfikacja_przez']
    raw_id_fields = ['ostatnia_modyfikacja_przez']
    fieldsets = (
        (_('Salon'), {
            'fields': ('nazwa_salonu', 'adres', 'telefon', 'email_kontaktowy'),
        }),
        (_('Harmonogram'), {
            'fields': ('slot_minuty', 'bufor_minuty', 'godziny_otwarcia'),
        }),
        (_('Polityki'), {
            'fields': ('polityka_zaliczek', 'harmonogram_powiadomien'),
        }),
        (_('Finansowe'), {
            'fields': ('stawka_vat_domyślna',),
        }),
        (_('Konserwacja'), {
            'fields': ('tryb_konserwacji', 'komunikat_konserwacji'),
        }),
        (_('Metadata'), {
            'fields': ('ostatnia_modyfikacja_przez', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def has_add_permission(self, request):
        return not UstawieniaSystemowe.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if change:
            obj.ostatnia_modyfikacja_przez = request.user
        super().save_model(request, obj, form, change)


@admin.register(StatystykaSnapshot)
class StatystykaSnapshotAdmin(admin.ModelAdmin):
    list_display = ['okres', 'data_od', 'data_do', 'liczba_wizyt_total',
                    'liczba_wizyt_zrealizowanych', 'przychod_total', 'srednie_oblozenie_pracownikow']
    list_filter = ['okres', 'data_od']
    ordering = ['-data_od']
    date_hierarchy = 'data_od'
    readonly_fields = ['created_at']
    fieldsets = (
        (_('Okres'), {
            'fields': ('okres', 'data_od', 'data_do'),
        }),
        (_('Wizyty'), {
            'fields': ('liczba_wizyt_total', 'liczba_wizyt_zrealizowanych',
                       'liczba_anulacji', 'liczba_noshow'),
        }),
        (_('Przychody'), {
            'fields': ('przychod_total', 'przychod_zaliczek'),
        }),
        (_('Klienci'), {
            'fields': ('liczba_nowych_klientow', 'liczba_powracajacych_klientow'),
        }),
        (_('Pracownicy'), {
            'fields': ('srednie_oblozenie_pracownikow',),
        }),
        (_('Dodatkowe'), {
            'fields': ('dodatkowe_metryki',),
            'classes': ('collapse',),
        }),
    )

    def has_add_permission(self, request):
        return False


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ['id_short', 'typ', 'wlasciciel_prac', 'nazwa_pliku',
                    'rozmiar_display', 'aktywny', 'created_at']
    list_filter = ['typ', 'aktywny', 'created_at']
    search_fields = ['nazwa_pliku', 'opis', 'wlasciciel_prac__imie', 'wlasciciel_prac__nazwisko']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
    raw_id_fields = ['wlasciciel_prac']
    actions = ['aktywuj_materialy', 'deaktywuj_materialy']
    fieldsets = (
        (_('Materiał'), {
            'fields': ('typ', 'wlasciciel_prac', 'url', 'opis'),
        }),
        (_('Plik'), {
            'fields': ('nazwa_pliku', 'rozmiar_bajtow', 'mime_type'),
        }),
        (_('Status'), {
            'fields': ('aktywny',),
        }),
    )

    def id_short(self, obj):
        return format_html("{}", str(obj.id)[:8])

    id_short.short_description = 'ID'

    def rozmiar_display(self, obj):
        if not obj.rozmiar_bajtow:
            return format_html("{}", '-')
        if obj.rozmiar_bajtow < 1024:
            return format_html("{} B", obj.rozmiar_bajtow)
        elif obj.rozmiar_bajtow < 1024 * 1024:
            return format_html("{:.1f} KB", obj.rozmiar_bajtow / 1024)
        else:
            return format_html("{:.1f} MB", obj.rozmiar_bajtow / (1024 * 1024))

    rozmiar_display.short_description = 'Rozmiar'

    def aktywuj_materialy(self, request, queryset: QuerySet):
        updated = queryset.update(aktywny=True)
        self.message_user(request, format_html('Aktywowano {} materiałów.', updated))

    aktywuj_materialy.short_description = 'Aktywuj wybrane materiały'

    def deaktywuj_materialy(self, request, queryset: QuerySet):
        updated = queryset.update(aktywny=False)
        self.message_user(request, format_html('Deaktywowano {} materiałów.', updated))

    deaktywuj_materialy.short_description = 'Deaktywuj wybrane materiały'


@admin.register(Notatka)
class NotatkaAdmin(admin.ModelAdmin):
    list_display = ['id_short', 'wizyta_link', 'autor',
                    # POPRAWKA: Zmieniamy 'czas' na 'created_at'
                    'created_at',
                    'widoczna_dla_klienta', 'tresc_short']
    # POPRAWKA: Zmieniamy 'czas' na 'created_at'
    list_filter = ['widoczna_dla_klienta', 'created_at']
    search_fields = ['tresc', 'wizyta__klient__imie', 'wizyta__klient__nazwisko', 'autor__email']
    # POPRAWKA: Zmieniamy 'czas' na 'created_at'
    ordering = ['-created_at']
    # POPRAWKA: Zmieniamy 'czas' na 'created_at'
    date_hierarchy = 'created_at'
    # POPRAWKA: Zmieniamy 'czas' na 'created_at'
    readonly_fields = ['created_at', 'autor']
    raw_id_fields = ['wizyta', 'autor']
    fieldsets = (
        (_('Notatka'), {
            'fields': ('wizyta', 'autor', 'tresc'),
        }),
        (_('Widoczność'), {
            'fields': ('widoczna_dla_klienta',),
        }),
        (_('Czas'), {
            # POPRAWKA: Zmieniamy 'czas' na 'created_at'
            'fields': ('created_at',),
        }),
    )

    def id_short(self, obj):
        return format_html("{}", str(obj.id)[:8])

    id_short.short_description = 'ID'

    def tresc_short(self, obj):
        short_tresc = obj.tresc[:50] + '...' if len(obj.tresc) > 50 else obj.tresc
        return format_html("{}", short_tresc)

    tresc_short.short_description = 'Treść'

    def wizyta_link(self, obj):
        url = reverse('admin:{}_{}_change'.format(obj.wizyta._meta.app_label, obj.wizyta._meta.model_name),
                      args=[obj.wizyta.id])
        return format_html('<a href="{}">Wizyta #{}</a>', url, str(obj.wizyta.id)[:8])

    wizyta_link.short_description = 'Wizyta'

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.autor = request.user
        super().save_model(request, obj, form, change)


# ============================================================================
# CUSTOM ADMIN SITE CONFIGURATION (Aktywacja Dashboardu)
# ============================================================================

class BeautySalonAdminSite(admin.AdminSite):
    """Custom admin site z dashboardem."""
    site_header = 'Beauty Salon - Panel Administracyjny'
    site_title = 'Beauty Salon Admin'
    index_title = 'Zarządzanie salonem kosmetycznym - Dashboard'

    def index(self, request, extra_context=None):
        """Custom dashboard z statystykami."""
        extra_context = extra_context or {}

        # Dzisiejsze statystyki
        today = timezone.now().date()
        tomorrow = today + timedelta(days=1)

        today_appointments = Wizyta.objects.filter(
            termin_start__date=today
        )

        # Użycie Wizyta.objects.upcoming() z managera
        upcoming_appointments = Wizyta.objects.upcoming().filter(
            termin_start__date__lte=tomorrow
        ).select_related('klient', 'pracownik', 'usluga')[:10]

        # Statystyki miesiąca
        month_start = today.replace(day=1)
        # Użycie Wizyta.objects.for_date_range() z managera
        month_appointments = Wizyta.objects.for_date_range(
            start_date=month_start,
            end_date=today
        )

        # Oczekujące urlopy
        pending_leaves = Urlop.objects.filter(
            status='oczekujacy'
        ).select_related('pracownik')[:5]

        # Najnowsze logi (ostatnie 10)
        recent_logs = LogEntry.objects.select_related('uzytkownik')[:10]

        extra_context.update({
            'today_stats': {
                'total': today_appointments.count(),
                'confirmed': today_appointments.filter(status='potwierdzona').count(),
                'completed': today_appointments.filter(status='zrealizowana').count(),
                'cancelled': today_appointments.filter(status='odwolana').count(),
            },
            'month_stats': {
                'total': month_appointments.count(),
                # Użycie metody revenue_summary() z WizytaQuerySet/WizytaManager
                'revenue': month_appointments.revenue_summary()['total_revenue'] or 0,
            },
            'upcoming_appointments': upcoming_appointments,
            'pending_leaves': pending_leaves,
            # Użycie Klient.active z ActiveManager
            'active_clients': Klient.active.count(),
            'active_employees': Pracownik.objects.filter(aktywny=True).count(),
            'active_services': Usluga.objects.filter(publikowana=True).count(),
            'recent_logs': recent_logs,
        })

        return super().index(request, extra_context)


# ZMIANA: Aktywacja Custom Admin Site (Dashboardu)
admin_site = BeautySalonAdminSite(name='beauty_salon_admin')

# Rejestracja wszystkich modeli w admin_site
admin_site.register(User, UserAdmin)
admin_site.register(Usluga, UslugaAdmin)
admin_site.register(Pracownik, PracownikAdmin)
admin_site.register(Grafik, GrafikAdmin)
admin_site.register(Urlop, UrlopAdmin)
admin_site.register(Klient, KlientAdmin)
admin_site.register(Wizyta, WizytaAdmin)
admin_site.register(Notatka, NotatkaAdmin)
admin_site.register(Material, MaterialAdmin)
admin_site.register(Platnosc, PlatnoscAdmin)
admin_site.register(Faktura, FakturaAdmin)
admin_site.register(Powiadomienie, PowiadomienieAdmin)
admin_site.register(RaportPDF, RaportPDFAdmin)
admin_site.register(LogEntry, LogEntryAdmin)
admin_site.register(UstawieniaSystemowe, UstawieniaSystemoweAdmin)
admin_site.register(StatystykaSnapshot, StatystykaSnapshotAdmin)