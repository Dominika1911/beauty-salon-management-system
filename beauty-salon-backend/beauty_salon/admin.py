from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db.models import JSONField
from django.forms import widgets
from django.utils.translation import gettext_lazy as _
from .models import (
    User, Usluga, Pracownik, Klient, Wizyta, Grafik, Notatka, Material, Platnosc, Faktura,
    Powiadomienie, UstawieniaSystemowe, StatystykaSnapshot, LogEntry,
    generate_employee_number, RaportPDF  # Wymagane do walidacji numeru pracownika
)


# Pomocniczy widżet dla pól JSON
class PrettyJSONWidget(widgets.Textarea):
    """Widżet do ładnego wyświetlania JSON w panelu admina."""

    def __init__(self, **kwargs):
        kwargs['attrs'] = {'rows': 4, 'cols': 60}
        super().__init__(**kwargs)

    def render(self, name, value, attrs=None, renderer=None):
        import json
        if value and isinstance(value, dict):
            value = json.dumps(value, indent=2, ensure_ascii=False)
        return super().render(name, value, attrs, renderer)


# ============================================================================
# 1. USER MANAGEMENT (Użytkownicy, Klienci, Pracownicy)
# ============================================================================

class PracownikInline(admin.StackedInline):
    """Edycja profilu Pracownika z poziomu edycji Użytkownika."""
    model = Pracownik
    can_delete = False
    verbose_name_plural = 'Profil Pracownika'
    fk_name = 'user'
    fieldsets = (
        (None, {'fields': ('nr', 'imie', 'nazwisko', 'telefon', 'aktywny', 'kompetencje')}),
        ('Metryki', {'fields': ('liczba_wizyt', 'srednia_ocena', 'data_zatrudnienia'), 'classes': ('collapse',)}),
    )
    # Pole nr ma być tylko do odczytu, ponieważ jest generowane przez funkcję
    readonly_fields = ('nr', 'liczba_wizyt', 'srednia_ocena')


class KlientInline(admin.StackedInline):
    """Edycja profilu Klienta z poziomu edycji Użytkownika."""
    model = Klient
    can_delete = False
    verbose_name_plural = 'Profil Klienta'
    fk_name = 'user'
    fieldsets = (
        (None, {'fields': ('imie', 'nazwisko', 'email', 'telefon', 'preferowany_kontakt')}),
        ('GDPR i Marketing',
         {'fields': ('zgoda_marketing', 'deleted_at', 'notatki_wewnetrzne'), 'classes': ('collapse',)}),
        ('Metryki', {'fields': ('liczba_wizyt', 'laczna_wydana_kwota'), 'classes': ('collapse',)}),
    )
    readonly_fields = ('deleted_at', 'liczba_wizyt', 'laczna_wydana_kwota')


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Zarządzanie użytkownikami i ich rolami."""
    list_display = (
        'email', 'is_active', 'is_staff', 'get_role_display_name',
        'last_login', 'created_at'
    )
    list_filter = ('is_staff', 'is_active', 'role')
    search_fields = ('email',)
    ordering = ('email',)
    inlines = [PracownikInline, KlientInline]

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Rola Biznesowa', {'fields': ('role',)}),
        ('Uprawnienia Django', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
            'description': 'Uprawnienia Django (dla admin.site)',
        }),
        ('Bezpieczeństwo (Audit Log)', {
            'fields': ('last_login_ip', 'failed_login_attempts', 'account_locked_until'),
            'classes': ('collapse',),
        }),
        ('Historia', {'fields': ('last_login', 'created_at', 'updated_at')}),
    )
    readonly_fields = ('last_login', 'created_at', 'updated_at', 'last_login_ip')
    # Używamy email jako login, więc usuwamy 'username' z formularza
    BaseUserAdmin.fieldsets = tuple(fs for fs in BaseUserAdmin.fieldsets if 'username' not in fs[1]['fields'])


@admin.register(Pracownik)
class PracownikAdmin(admin.ModelAdmin):
    list_display = ('nr', 'get_full_name', 'user_email', 'aktywny', 'data_zatrudnienia', 'liczba_wizyt',
                    'srednia_ocena')
    list_filter = ('aktywny', 'kompetencje')
    search_fields = ('nr', 'imie', 'nazwisko', 'user__email')
    readonly_fields = ('nr', 'liczba_wizyt', 'srednia_ocena', 'created_at', 'updated_at')

    def get_full_name(self, obj):
        return obj.get_full_name()

    get_full_name.short_description = 'Imię i Nazwisko'

    def user_email(self, obj):
        return obj.user.email if obj.user else None

    user_email.short_description = 'Email Użytkownika'

    # Wypełnianie numeru pracownika przy zapisie
    def save_model(self, request, obj, form, change):
        if not obj.nr:
            obj.nr = generate_employee_number()
        super().save_model(request, obj, form, change)


@admin.register(Klient)
class KlientAdmin(admin.ModelAdmin):
    list_display = ('get_full_name', 'email', 'telefon', 'liczba_wizyt', 'laczna_wydana_kwota', 'zgoda_marketing',
                    'deleted_at')
    list_filter = ('zgoda_marketing', 'preferowany_kontakt', 'deleted_at')
    search_fields = ('imie', 'nazwisko', 'email', 'telefon')
    readonly_fields = ('deleted_at', 'liczba_wizyt', 'laczna_wydana_kwota', 'created_at', 'updated_at')

    def get_full_name(self, obj):
        return obj.get_full_name()

    get_full_name.short_description = 'Klient'


# ============================================================================
# 2. USŁUGI, WIZYTY, PŁATNOŚCI
# ============================================================================

@admin.register(Usluga)
class UslugaAdmin(admin.ModelAdmin):
    list_display = ('nazwa', 'kategoria', 'cena', 'czas_trwania', 'publikowana', 'liczba_rezerwacji')
    list_filter = ('kategoria', 'publikowana')
    search_fields = ('nazwa', 'opis')
    ordering = ('kategoria', 'nazwa')
    list_editable = ('publikowana',)
    readonly_fields = ('liczba_rezerwacji', 'created_at', 'updated_at')

    # Dodanie JSON field do edycji (dla promocji)
    formfield_overrides = {
        JSONField: {'widget': PrettyJSONWidget},
    }


class PlatnoscInline(admin.TabularInline):
    model = Platnosc
    extra = 0
    fields = ('kwota', 'typ', 'status', 'metoda_platnosci', 'data_platnosci')
    readonly_fields = ('created_at', 'reference')
    formfield_overrides = {
        JSONField: {'widget': PrettyJSONWidget},
    }


@admin.register(Wizyta)
class WizytaAdmin(admin.ModelAdmin):
    list_display = ('klient', 'pracownik', 'usluga', 'status', 'termin_start', 'kanal_rezerwacji',
                    'przypomnienie_wyslane')
    list_filter = ('status', 'kanal_rezerwacji', 'pracownik', 'usluga')
    search_fields = ('klient__nazwisko', 'pracownik__nazwisko', 'usluga__nazwa')
    date_hierarchy = 'termin_start'
    inlines = [PlatnoscInline]

    fieldsets = (
        ('Podstawowe Informacje', {'fields': ('klient', 'pracownik', 'usluga', 'status', 'kanal_rezerwacji')}),
        ('Termin', {'fields': ('termin_start', 'termin_koniec', 'timespan')}),  # timespan jest wypełniany auto
        ('Anulacje', {'fields': ('anulowana_przez', 'data_anulowania', 'powod_anulowania'), 'classes': ('collapse',)}),
        ('Notatki i Przypomnienia',
         {'fields': ('notatki_klienta', 'notatki_wewnetrzne', 'przypomnienie_wyslane', 'data_wyslania_przypomnienia')}),
    )
    readonly_fields = ('anulowana_przez', 'data_anulowania', 'data_wyslania_przypomnienia', 'timespan', 'created_at',
                       'updated_at')


@admin.register(Platnosc)
class PlatnoscAdmin(admin.ModelAdmin):
    list_display = ('wizyta', 'kwota', 'status', 'typ', 'metoda_platnosci', 'data_platnosci')
    list_filter = ('status', 'typ', 'metoda_platnosci')
    search_fields = ('wizyta__klient__nazwisko', 'reference')
    readonly_fields = ('reference', 'created_at', 'updated_at')


@admin.register(Faktura)
class FakturaAdmin(admin.ModelAdmin):
    list_display = ('numer', 'klient', 'wizyta', 'data_wystawienia', 'kwota_brutto', 'zaplacona')
    list_filter = ('zaplacona', 'data_wystawienia')
    search_fields = ('numer', 'klient__nazwisko')
    date_hierarchy = 'data_wystawienia'
    fieldsets = (
        ('Numeracja i Daty', {'fields': ('numer', 'data_wystawienia', 'data_sprzedazy', 'termin_platnosci')}),
        ('Relacje', {'fields': ('klient', 'wizyta')}),
        ('Kwoty i VAT', {'fields': ('kwota_netto', 'stawka_vat', 'kwota_vat', 'kwota_brutto')}),
        ('Status', {'fields': ('zaplacona', 'data_zaplaty', 'plik_pdf')}),
    )
    readonly_fields = ('kwota_vat', 'kwota_brutto', 'created_at', 'updated_at')


# ============================================================================
# 3. GRAFIK, NOTATKI, MATERIAŁY, POWIADOMIENIA
# ============================================================================

@admin.register(Grafik)
class GrafikAdmin(admin.ModelAdmin):
    list_display = ('pracownik', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('pracownik__nazwisko',)
    formfield_overrides = {
        JSONField: {'widget': PrettyJSONWidget},
    }
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Notatka)
class NotatkaAdmin(admin.ModelAdmin):
    list_display = ('wizyta', 'autor', 'czas', 'widoczna_dla_klienta')
    list_filter = ('widoczna_dla_klienta', 'autor')
    search_fields = ('wizyta__klient__nazwisko', 'tresc')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ('typ', 'wlasciciel_prac', 'aktywny', 'nazwa_pliku', 'created_at')
    list_filter = ('typ', 'aktywny')
    search_fields = ('nazwa_pliku', 'wlasciciel_prac__nazwisko', 'opis')
    readonly_fields = ('nazwa_pliku', 'rozmiar_bajtow', 'mime_type', 'created_at', 'updated_at')


@admin.register(Powiadomienie)
class PowiadomienieAdmin(admin.ModelAdmin):
    list_display = ('typ', 'klient', 'status', 'kanal', 'termin_wysylki', 'data_wyslania')
    list_filter = ('status', 'typ', 'kanal')
    search_fields = ('klient__nazwisko', 'tresc')
    date_hierarchy = 'termin_wysylki'
    readonly_fields = ('data_wyslania', 'liczba_prob', 'komunikat_bledu', 'created_at', 'updated_at')


# ============================================================================
# 4. RAPORTOWANIE, LOGOWANIE, UST. SYSTEMOWE
# ============================================================================

@admin.register(RaportPDF)
class RaportPDFAdmin(admin.ModelAdmin):
    list_display = ('typ', 'tytul', 'data_od', 'data_do', 'wygenerowany_przez', 'created_at')
    list_filter = ('typ', 'wygenerowany_przez')
    search_fields = ('tytul', 'wygenerowany_przez__email')
    readonly_fields = ('rozmiar_pliku', 'wygenerowany_przez', 'created_at', 'updated_at')
    formfield_overrides = {
        JSONField: {'widget': PrettyJSONWidget},
    }


@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    # Logi są tylko do odczytu (wymagane przez audit log)
    list_display = ('czas', 'typ', 'poziom', 'uzytkownik', 'adres_ip', 'entity_type')
    list_filter = ('poziom', 'typ')
    search_fields = ('opis', 'uzytkownik__email', 'adres_ip')
    date_hierarchy = 'czas'
    readonly_fields = list_display + ('opis', 'user_agent', 'entity_id', 'metadata', 'created_at', 'updated_at')

    # Blokowanie możliwości edycji logów
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(UstawieniaSystemowe)
class UstawieniaSystemoweAdmin(admin.ModelAdmin):
    # Zapewnienie, że jest tylko jeden rekord (singleton)
    def has_add_permission(self, request):
        return UstawieniaSystemowe.objects.count() == 0

    list_display = ('nazwa_salonu', 'slot_minuty', 'tryb_konserwacji')
    readonly_fields = ('ostatnia_modyfikacja_przez', 'created_at', 'updated_at')
    formfield_overrides = {
        JSONField: {'widget': PrettyJSONWidget},
    }


@admin.register(StatystykaSnapshot)
class StatystykaSnapshotAdmin(admin.ModelAdmin):
    list_display = ('okres', 'data_od', 'data_do', 'liczba_wizyt_total', 'przychod_total')
    list_filter = ('okres',)
    date_hierarchy = 'data_od'
    readonly_fields = ('created_at', 'updated_at')
    formfield_overrides = {
        JSONField: {'widget': PrettyJSONWidget},
    }