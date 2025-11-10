from django.contrib import admin
from .models import (
    Usluga, Klient, Pracownik, Wizyta, Grafik,
    Platnosc, Faktura, UstawieniaSystemowe, Material, LogEntry
)

@admin.register(Usluga)
class UslugaAdmin(admin.ModelAdmin):
    list_display = ("nazwa", "kategoria", "cena", "czas_trwania", "publikowana", "promocja", "liczba_rezerwacji")
    list_filter = ("kategoria", "publikowana", "promocja")
    search_fields = ("nazwa", "kategoria", "opis")
    ordering = ("kategoria", "nazwa")

@admin.register(Pracownik)
class PracownikAdmin(admin.ModelAdmin):
    list_display = ("nr", "imie", "nazwisko", "aktywny", "liczba_wizyt", "srednia_ocena")
    search_fields = ("nr", "imie", "nazwisko")

@admin.register(Klient)
class KlientAdmin(admin.ModelAdmin):
    list_display = ("imie", "nazwisko", "email", "telefon", "liczba_wizyt", "laczna_wydana_kwota")
    search_fields = ("imie", "nazwisko", "email", "telefon")

@admin.register(Wizyta)
class WizytaAdmin(admin.ModelAdmin):
    list_display = ("pracownik", "klient", "usluga", "status", "termin_start", "termin_koniec")
    list_filter = ("status", "pracownik")
    date_hierarchy = "termin_start"
    search_fields = ("pracownik__nr", "klient__nazwisko", "usluga__nazwa")

admin.site.register(Grafik)
admin.site.register(Platnosc)
admin.site.register(Faktura)
admin.site.register(UstawieniaSystemowe)
admin.site.register(Material)
admin.site.register(LogEntry)
