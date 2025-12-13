import random
import logging
from datetime import timedelta, datetime
from decimal import Decimal
from typing import Any, Optional, List, Dict, Tuple, Iterable
from dataclasses import dataclass

from django.core.management.base import BaseCommand, CommandParser
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Q
from django.core.files.base import ContentFile
from django.db.models.base import ModelBase

from beauty_salon.models import (
    Service, Employee, Client, Schedule, TimeOff, Appointment,
    Note, Payment, Invoice, MediaAsset, Notification, SystemSettings,
    AuditLog, StatsSnapshot, ReportPDF,
)
from beauty_salon.utils import calculate_vat

# Opcjonalna zależność dla paska postępu
try:
    from tqdm import tqdm
except ImportError:
    def tqdm(iterable: Iterable[Any], **kwargs: Any) -> Iterable[Any]:
        """Implementacja zastępcza gdy tqdm nie jest dostępny."""
        return iterable


logger = logging.getLogger(__name__)
User = get_user_model()


@dataclass
class StatystykiSeedowania:
    """Kontener do śledzenia statystyk operacji seedowania."""
    pracownicy_utworzeni: int = 0
    klienci_utworzeni: int = 0
    uslugi_utworzone: int = 0
    wizyty_utworzone: int = 0
    platnosci_utworzone: int = 0
    faktury_utworzone: int = 0
    powiadomienia_utworzone: int = 0
    media_utworzone: int = 0
    logi_audytu_utworzone: int = 0

    def wyswietl_podsumowanie(self) -> str:
        """Generuje sformatowane podsumowanie statystyk seedowania."""
        return (
            f"\n{'=' * 80}\n"
            f"{'PODSUMOWANIE SEEDOWANIA BAZY DANYCH':^80}\n"
            f"{'=' * 80}\n"
            f"  Pracownicy:      {self.pracownicy_utworzeni:>6}\n"
            f"  Klienci:         {self.klienci_utworzeni:>6}\n"
            f"  Usługi:          {self.uslugi_utworzone:>6}\n"
            f"  Wizyty:          {self.wizyty_utworzone:>6}\n"
            f"  Płatności:       {self.platnosci_utworzone:>6}\n"
            f"  Faktury:         {self.faktury_utworzone:>6}\n"
            f"  Powiadomienia:   {self.powiadomienia_utworzone:>6}\n"
            f"  Zasoby mediów:   {self.media_utworzone:>6}\n"
            f"  Logi audytu:     {self.logi_audytu_utworzone:>6}\n"
            f"{'=' * 80}\n"
        )


class Command(BaseCommand):
    help = (
        "Kompleksowe seedowanie bazy danych dla systemu zarządzania salonem kosmetycznym. "
        "Generuje realistyczne dane testowe we wszystkich encjach zachowując "
        "integralność referencyjną i spójność logiki biznesowej."
    )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.stats = StatystykiSeedowania()
        self.now = timezone.now()
        self.manager: Optional[User] = None
        self.employees: List[Employee] = []
        self.clients: List[Client] = []
        self.services: List[Service] = []
        self.appointments: List[Appointment] = []

    def add_arguments(self, parser: CommandParser) -> None:
        """Konfiguruje argumenty wiersza poleceń."""
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Usuń wszystkie istniejące dane demo przed operacją seedowania.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Wymuś operację seedowania nawet jeśli dane już istnieją (bez czyszczenia).",
        )
        parser.add_argument(
            "--clients",
            type=int,
            default=10,
            help=(
                "Docelowa liczba profili klientów do wygenerowania (minimum: 1, domyślnie: 10). "
                "Dodatkowi klienci ponad bazowy zestaw zostaną automatycznie wygenerowani."
            ),
        )

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        """
        Główna metoda wykonawcza seedowania bazy danych.

        Orkiestruje cały proces seedowania w sposób transakcyjny,
        zapewniając albo pełny sukces albo pełne wycofanie zmian.
        """
        tryb_czyszczenia = options.get("clear", False)
        tryb_wymuszony = options.get("force", False)
        docelowa_liczba_klientow = max(1, options.get("clients", 10))

        self._wyswietl_naglowek()

        # Walidacja warunków wykonania
        if not self._waliduj_warunki_wykonania(tryb_czyszczenia, tryb_wymuszony):
            return

        # Wykonaj pipeline seedowania
        try:
            self._seeduj_ustawienia_systemowe()
            self._seeduj_uzytkownikow_i_pracownikow()
            self._seeduj_klientow(docelowa_liczba_klientow)
            self._seeduj_uslugi()
            self._przypisz_umiejetnosci_pracownikom()
            self._seeduj_grafiki_pracy()
            self._seeduj_nieobecnosci()
            self._seeduj_wizyty()
            self._seeduj_notatki()
            self._seeduj_platnosci_i_faktury()
            self._aktualizuj_metryki()
            self._seeduj_powiadomienia()
            self._seeduj_zasoby_mediow()
            self._seeduj_migawki_statystyk()
            self._seeduj_raporty_pdf()
            self._seeduj_logi_audytu()

            self._wyswietl_podsumowanie()

        except Exception as e:
            logger.exception("Krytyczny błąd podczas seedowania bazy danych")
            self.stdout.write(
                self.style.ERROR(
                    f"\n Seedowanie nie powiodło się: {str(e)}\n"
                    "Wszystkie zmiany zostały wycofane.\n"
                )
            )
            raise

    def _wyswietl_naglowek(self) -> None:
        """Wyświetla profesjonalny nagłówek operacji seedowania."""
        self.stdout.write("")
        self.stdout.write("=" * 80)
        self.stdout.write(
            self.style.SUCCESS(
                f"{'SYSTEM ZARZĄDZANIA SALONEM KOSMETYCZNYM':^80}"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"{'Generator Danych Demonstracyjnych - Praca Inżynierska':^80}"
            )
        )
        self.stdout.write("=" * 80)
        self.stdout.write("")

    def _waliduj_warunki_wykonania(
        self, tryb_czyszczenia: bool, tryb_wymuszony: bool
    ) -> bool:
        """
        Waliduje czy operacja seedowania może być wykonana.

        Args:
            tryb_czyszczenia: Czy należy wyczyścić istniejące dane
            tryb_wymuszony: Czy wymusić seedowanie mimo istniejących danych

        Returns:
            True jeśli operacja może być kontynuowana, False w przeciwnym razie
        """
        if tryb_czyszczenia:
            self._wyczysc_dane_demo()
            return True

        czy_dane_istnieja = (
            Appointment.objects.exists() or
            Client.objects.exists() or
            Employee.objects.exists()
        )

        if czy_dane_istnieja and not tryb_wymuszony:
            self.stdout.write(
                self.style.WARNING(
                    "\n W bazie danych znajdują się już dane (wizyty/klienci/pracownicy).\n\n"
                    "Dostępne opcje:\n"
                    "  • python manage.py seed_database --clear\n"
                    "    Usuń dane demo i zasiej od nowa\n\n"
                    "  • python manage.py seed_database --force\n"
                    "    Dodaj kolejne dane mimo istniejących rekordów\n\n"
                )
            )
            return False

        return True

    def _seeduj_ustawienia_systemowe(self) -> None:
        """
        Konfiguruje globalne ustawienia systemowe salonu.

        Definiuje parametry operacyjne takie jak: dane kontaktowe, godziny otwarcia,
        stawki VAT, polityki depozytów oraz konfigurację rezerwacji online.
        """
        self.stdout.write(" Konfiguracja ustawień systemowych...")

        ustawienia = SystemSettings.load()
        ustawienia.salon_name = "Beauty Salon Management System"
        ustawienia.address = "ul. Akademicka 15, 00-901 Warszawa"
        ustawienia.phone = "+48221234567"
        ustawienia.contact_email = "kontakt@beauty-salon.pl"
        ustawienia.slot_minutes = 30
        ustawienia.buffer_minutes = 10
        ustawienia.default_vat_rate = Decimal("23.00")

        ustawienia.deposit_policy = {
            "require_deposit": True,
            "default_deposit_percent": 30,
            "free_cancellation_hours": 24,
            "no_show_deposit_forfeit_percent": 100,
            "late_cancellation_deposit_forfeit_percent": 50,
            "forfeit_deposit_on_cancellation": True,
        }

        ustawienia.opening_hours = {
            "Monday": {"open": "09:00", "close": "19:00"},
            "Tuesday": {"open": "09:00", "close": "19:00"},
            "Wednesday": {"open": "09:00", "close": "19:00"},
            "Thursday": {"open": "10:00", "close": "20:00"},
            "Friday": {"open": "09:00", "close": "19:00"},
            "Saturday": {"open": "09:00", "close": "15:00"},
            "Sunday": None,
        }

        ustawienia.is_online_booking_enabled = True
        ustawienia.maintenance_mode = False
        ustawienia.maintenance_message = ""
        ustawienia.save()

        self.stdout.write(self.style.SUCCESS("  ✓ Ustawienia systemowe zapisane"))

    def _seeduj_uzytkownikow_i_pracownikow(self) -> None:
        """
        Tworzy konta użytkowników i profile pracowników.

        Generuje:
        - 1 konto managera z uprawnieniami administracyjnymi
        - 5 kont pracowników z różnymi specjalizacjami

        UWAGA: Dane logowania są przeznaczone WYŁĄCZNIE do środowisk deweloperskich.
        W produkcji należy używać bezpiecznych haseł i zmiennych środowiskowych.
        """
        self.stdout.write("Tworzenie użytkowników i pracowników...")

        # Manager z pełnymi uprawnieniami
        self.manager = User.objects.create_superuser(
            email="manager@beauty-salon.pl",
            password="AdminDemo2024!",
            first_name="Dominika",
            last_name="Jedynak",
            role=User.RoleChoices.MANAGER,
        )

        # Definicje pracowników z różnymi specjalizacjami
        definicje_pracownikow = [
            {
                "email": "anna.stylist@beauty-salon.pl",
                "first_name": "Anna",
                "last_name": "Kowalska",
                "phone": "+48501234567",
                "specialization": "Stylista włosów",
            },
            {
                "email": "marta.nails@beauty-salon.pl",
                "first_name": "Marta",
                "last_name": "Wiśniewska",
                "phone": "+48502345678",
                "specialization": "Specjalista manicure",
            },
            {
                "email": "paulina.beauty@beauty-salon.pl",
                "first_name": "Paulina",
                "last_name": "Zielińska",
                "phone": "+48503456789",
                "specialization": "Kosmetolog",
            },
            {
                "email": "magda.lashes@beauty-salon.pl",
                "first_name": "Magda",
                "last_name": "Nowicka",
                "phone": "+48504567890",
                "specialization": "Stylistka rzęs i brwi",
            },
            {
                "email": "karolina.massage@beauty-salon.pl",
                "first_name": "Karolina",
                "last_name": "Mazur",
                "phone": "+48505678901",
                "specialization": "Masażystka",
            },
        ]

        for dane in definicje_pracownikow:
            # Utworzenie konta użytkownika
            user = User.objects.create_user(
                email=dane["email"],
                password="PracownikDemo2024!",
                first_name=dane["first_name"],
                last_name=dane["last_name"],
                role=User.RoleChoices.EMPLOYEE,
            )

            # Utworzenie profilu pracownika
            employee, _ = Employee.objects.get_or_create(user=user)
            employee.first_name = dane["first_name"]
            employee.last_name = dane["last_name"]
            employee.phone = dane["phone"]
            employee.hired_at = (
                self.now.date() - timedelta(days=random.randint(180, 1095))
            )
            employee.is_active = True
            employee.save()

            self.employees.append(employee)
            self.stats.pracownicy_utworzeni += 1

        self.stdout.write(
            self.style.SUCCESS(
                f" Utworzono 1 managera i {len(self.employees)} pracowników"
            )
        )

    def _seeduj_klientow(self, liczba_docelowa: int) -> None:
        """
        Generuje profile klientów wraz z kontami użytkowników.

        Args:
            liczba_docelowa: Docelowa liczba klientów do wygenerowania
        """
        self.stdout.write(f"Tworzenie {liczba_docelowa} profili klientów...")

        # Bazowy zestaw klientów z realistycznymi danymi
        bazowi_klienci = [
            ("karolina.jasinska@email.pl", "Karolina", "Jasińska", "+48 601 111 001"),
            ("magda.kwiatkowska@email.pl", "Magda", "Kwiatkowska", "+48 602 111 002"),
            ("joanna.lewandowska@email.pl", "Joanna", "Lewandowska", "+48 603 111 003"),
            ("sylwia.pawlak@email.pl", "Sylwia", "Pawlak", "+48 604 111 004"),
            ("natalia.walczak@email.pl", "Natalia", "Walczak", "+48 605 111 005"),
            ("ewelina.marciniak@email.pl", "Ewelina", "Marciniak", "+48 606 111 006"),
            ("justyna.rutkowska@email.pl", "Justyna", "Rutkowska", "+48 607 111 007"),
            ("aleksandra.baran@email.pl", "Aleksandra", "Baran", "+48 608 111 008"),
            ("paulina.duda@email.pl", "Paulina", "Duda", "+48 609 111 009"),
            ("izabela.czarnecka@email.pl", "Izabela", "Czarnecka", "+48 610 111 010"),
        ]

        definicje_klientow = list(bazowi_klienci)

        # Generowanie dodatkowych klientów jeśli potrzeba
        if liczba_docelowa > len(definicje_klientow):
            dodatkowi_potrzebni = liczba_docelowa - len(definicje_klientow)
            for i in range(dodatkowi_potrzebni):
                numer = len(definicje_klientow) + 1
                definicje_klientow.append((
                    f"klient{numer}@beauty-demo.pl",
                    f"Klient{numer}",
                    f"Testowy{numer}",
                    f"+48 6{numer:02d} 111 {numer:03d}",
                ))

        # Przycinanie do docelowej liczby
        definicje_klientow = definicje_klientow[:liczba_docelowa]

        for email, imie, nazwisko, telefon in tqdm(
            definicje_klientow, desc="Generowanie klientów"
        ):
            # Utworzenie konta użytkownika
            user = User.objects.create_user(
                email=email,
                password="KlientDemo2024!",
                first_name=imie,
                last_name=nazwisko,
                role=User.RoleChoices.CLIENT,
            )

            # Utworzenie profilu klienta
            client, _ = Client.objects.get_or_create(user=user)
            client.first_name = imie
            client.last_name = nazwisko
            client.email = email
            client.phone = telefon
            client.marketing_consent = random.choice([True, False])
            client.preferred_contact = random.choice([
                Client.ContactPreference.EMAIL,
                Client.ContactPreference.SMS,
                Client.ContactPreference.PHONE,
            ])
            client.internal_notes = (
                "Profil wygenerowany automatycznie przez system seedowania "
                "w ramach danych demonstracyjnych pracy inżynierskiej."
            )
            client.save()

            self.clients.append(client)
            self.stats.klienci_utworzeni += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"  Utworzono {len(self.clients)} profili klientów"
            )
        )

    def _seeduj_uslugi(self) -> None:
        """
        Tworzy katalog usług oferowanych przez salon.

        Generuje kompleksowy zestaw usług podzielonych na kategorie:
        - Włosy (strzyżenie, koloryzacja, stylizacja)
        - Paznokcie (manicure, pedicure)
        - Twarz (zabiegi pielęgnacyjne, kosmetyczne)
        - Rzęsy i brwi (stylizacja, laminacja)
        - Ciało (masaże, zabiegi relaksacyjne)
        """
        self.stdout.write(" Tworzenie katalogu usług...")

        definicje_uslug = [
            # Kategoria: Włosy
            {
                "name": "Strzyżenie damskie z modelowaniem",
                "category": "Włosy",
                "price": Decimal("120.00"),
                "duration": 60,
                "description": (
                    "Profesjonalne strzyżenie damskie z modelowaniem. "
                    "Zawiera konsultację, mycie, strzyżenie i stylizację."
                ),
            },
            {
                "name": "Strzyżenie męskie",
                "category": "Włosy",
                "price": Decimal("70.00"),
                "duration": 40,
                "description": (
                    "Klasyczne strzyżenie męskie z myciem włosów "
                    "i prostą stylizacją."
                ),
            },
            {
                "name": "Koloryzacja jednolita",
                "category": "Włosy",
                "price": Decimal("250.00"),
                "duration": 120,
                "description": (
                    "Profesjonalna koloryzacja całości włosów jednolitym kolorem. "
                    "Zawiera konsultację, aplikację farby i pielęgnację."
                ),
            },
            {
                "name": "Balayage premium z tonowaniem",
                "category": "Włosy",
                "price": Decimal("380.00"),
                "duration": 180,
                "description": (
                    "Ekskluzywny zabieg rozjaśnienia techniką balayage "
                    "z profesjonalnym tonowaniem i pielęgnacją."
                ),
            },
            {
                "name": "Keratynowe prostowanie włosów",
                "category": "Włosy",
                "price": Decimal("450.00"),
                "duration": 150,
                "description": (
                    "Trwałe wygładzenie i prostowanie włosów z wykorzystaniem "
                    "profesjonalnej keratyny."
                ),
            },

            # Kategoria: Paznokcie
            {
                "name": "Manicure hybrydowy",
                "category": "Paznokcie",
                "price": Decimal("110.00"),
                "duration": 60,
                "description": (
                    "Klasyczny manicure hybrydowy z przygotowaniem płytki, "
                    "aplikacją lakieru hybrydowego i pielęgnacją skórek."
                ),
            },
            {
                "name": "Manicure żelowy z przedłużaniem",
                "category": "Paznokcie",
                "price": Decimal("180.00"),
                "duration": 90,
                "description": (
                    "Profesjonalne przedłużanie paznokci żelem z możliwością "
                    "dowolnej stylizacji i zdobień."
                ),
            },
            {
                "name": "Pedicure SPA",
                "category": "Paznokcie",
                "price": Decimal("160.00"),
                "duration": 75,
                "description": (
                    "Luksusowy pedicure z kąpielą stóp, peelingiem, "
                    "masażem i aplikacją lakieru hybrydowego."
                ),
            },

            # Kategoria: Twarz
            {
                "name": "Oczyszczanie manualne twarzy",
                "category": "Twarz",
                "price": Decimal("180.00"),
                "duration": 75,
                "description": (
                    "Głębokie oczyszczanie cery z usuwaniem zaskórników, "
                    "tonizacją i nawilżeniem."
                ),
            },
            {
                "name": "Mezoterapia mikroigłowa",
                "category": "Twarz",
                "price": Decimal("280.00"),
                "duration": 60,
                "description": (
                    "Zaawansowany zabieg odmładzający z wykorzystaniem "
                    "mezoterapii mikroigłowej i skoncentrowanych serum."
                ),
            },
            {
                "name": "Peeling kawitacyjny ultradźwiękowy",
                "category": "Twarz",
                "price": Decimal("150.00"),
                "duration": 45,
                "description": (
                    "Nieinwazyjne oczyszczanie skóry ultradźwiękami "
                    "z jednoczesnym nawilżeniem."
                ),
            },
            {
                "name": "Masaż kobido anti-aging",
                "category": "Twarz",
                "price": Decimal("200.00"),
                "duration": 50,
                "description": (
                    "Japoński masaż liftingujący twarz, pobudzający "
                    "produkcję kolagenu i poprawiający kontur twarzy."
                ),
            },

            # Kategoria: Rzęsy i brwi
            {
                "name": "Laminacja rzęs z botoxem",
                "category": "Rzęsy",
                "price": Decimal("180.00"),
                "duration": 70,
                "description": (
                    "Profesjonalne uniesienie i odżywienie rzęs z efektem "
                    "długotrwałego pogrubienia i podkręcenia."
                ),
            },
            {
                "name": "Henna pudrowa brwi",
                "category": "Brwi",
                "price": Decimal("90.00"),
                "duration": 40,
                "description": (
                    "Regulacja kształtu brwi z hennąpudrową zapewniającą "
                    "naturalny, trwały efekt."
                ),
            },
            {
                "name": "Laminacja brwi",
                "category": "Brwi",
                "price": Decimal("120.00"),
                "duration": 45,
                "description": (
                    "Nowoczesna metoda stylizacji brwi z długotrwałym "
                    "efektem ułożenia włosków."
                ),
            },

            # Kategoria: Ciało
            {
                "name": "Masaż relaksacyjny całego ciała",
                "category": "Ciało",
                "price": Decimal("200.00"),
                "duration": 60,
                "description": (
                    "Klasyczny masaż relaksacyjny całego ciała z użyciem "
                    "aromatycznych olejków."
                ),
            },
            {
                "name": "Masaż gorącymi kamieniami",
                "category": "Ciało",
                "price": Decimal("280.00"),
                "duration": 90,
                "description": (
                    "Głęboko relaksujący masaż z wykorzystaniem nagrzanych "
                    "kamieni wulkanicznych."
                ),
            },
            {
                "name": "Masaż antycellulitowy",
                "category": "Ciało",
                "price": Decimal("180.00"),
                "duration": 50,
                "description": (
                    "Intensywny masaż ujędrniający z profesjonalnymi "
                    "kosmetykami modelującymi sylwetkę."
                ),
            },
        ]

        for dane in tqdm(definicje_uslug, desc="Tworzenie usług"):
            service = Service.objects.create(
                name=dane["name"],
                category=dane["category"],
                price=dane["price"],
                duration=timedelta(minutes=dane["duration"]),
                description=dane["description"],
                is_published=True,
                image_url=f"https://picsum.photos/seed/{dane['name']}/800/600",
                promotion={},
            )
            self.services.append(service)
            self.stats.uslugi_utworzone += 1

        # Losowe przypisanie promocji (30% szans dla każdej usługi)
        for service in self.services:
            if random.random() < 0.30:
                service.promotion = {
                    "active": True,
                    "discount_percent": random.choice([10, 15, 20, 25]),
                    "description": "Promocja specjalna - ograniczona czasowo!",
                }
                service.save(update_fields=["promotion"])

        self.stdout.write(
            self.style.SUCCESS(
                f"  ✓ Utworzono {len(self.services)} usług w katalogu"
            )
        )

    def _przypisz_umiejetnosci_pracownikom(self) -> None:
        """
        Przypisuje konkretne umiejętności (usługi) poszczególnym pracownikom.

        Każdy pracownik otrzymuje zestaw usług zgodny z jego specjalizacją,
        co zapewnia realistyczną symulację organizacji pracy w salonie.
        """
        if not self.employees or not self.services:
            return

        self.stdout.write("Przypisywanie umiejętności pracownikom...")

        # Kategoryzacja usług
        uslugi_wlosy = [s for s in self.services if s.category == "Włosy"]
        uslugi_paznokcie = [s for s in self.services if s.category == "Paznokcie"]
        uslugi_twarz = [s for s in self.services if s.category == "Twarz"]
        uslugi_brwi = [s for s in self.services if s.category == "Brwi"]
        uslugi_rzesy = [s for s in self.services if s.category == "Rzęsy"]
        uslugi_cialo = [s for s in self.services if s.category == "Ciało"]

        # Wzorce specjalizacji dla kolejnych pracowników
        wzorce_umiejetnosci = [
            uslugi_wlosy + uslugi_brwi,          # Stylista włosów + brwi
            uslugi_paznokcie + uslugi_twarz,     # Manicure + kosmetyka
            uslugi_twarz + uslugi_brwi,          # Kosmetolog + brwi
            uslugi_rzesy + uslugi_brwi,          # Stylistka rzęs i brwi
            uslugi_cialo + uslugi_twarz,         # Masażystka + zabiegi na twarz
        ]

        for idx, employee in enumerate(self.employees):
            umiejetnosci = wzorce_umiejetnosci[idx % len(wzorce_umiejetnosci)]
            employee.skills.set(umiejetnosci)
            employee.save()

        self.stdout.write(
            self.style.SUCCESS(
                f" Przypisano umiejętności {len(self.employees)} pracownikom"
            )
        )

    def _seeduj_grafiki_pracy(self) -> None:
        """
        Tworzy harmonogramy pracy dla wszystkich pracowników.

        Definiuje:
        - Dostępność pracowników w poszczególne dni tygodnia
        - Standardowe godziny pracy
        - Przerwy śniadaniowe/obiadowe
        """
        self.stdout.write(" Tworzenie harmonogramów pracy...")

        # Standardowy szablon dostępności
        szablon_dostepnosci = [
            {"day": "Monday", "start": "09:00", "end": "17:00"},
            {"day": "Tuesday", "start": "09:00", "end": "17:00"},
            {"day": "Wednesday", "start": "09:00", "end": "17:00"},
            {"day": "Thursday", "start": "11:00", "end": "19:00"},
            {"day": "Friday", "start": "09:00", "end": "17:00"},
            {"day": "Saturday", "start": "09:00", "end": "14:00"},
        ]

        # Standardowe przerwy
        szablon_przerw = [
            {"day": "Monday", "start": "13:00", "end": "13:30"},
            {"day": "Tuesday", "start": "13:00", "end": "13:30"},
            {"day": "Wednesday", "start": "13:00", "end": "13:30"},
            {"day": "Thursday", "start": "15:00", "end": "15:30"},
            {"day": "Friday", "start": "13:00", "end": "13:30"},
        ]

        licznik_grafikow = 0
        for employee in self.employees:
            dostepnosc = list(szablon_dostepnosci)
            przerwy = list(szablon_przerw)

            # Dodanie różnorodności - niektórzy pracownicy mają skrócone grafiki
            if random.random() < 0.3:
                dostepnosc = [d.copy() for d in dostepnosc if d["day"] != "Saturday"]

            Schedule.objects.create(
                employee=employee,
                status=Schedule.Status.ACTIVE,
                availability_periods=dostepnosc,
                breaks=przerwy,
            )
            licznik_grafikow += 1

        self.stdout.write(
            self.style.SUCCESS(
                f" Utworzono {licznik_grafikow} harmonogramów pracy"
            )
        )

    def _seeduj_nieobecnosci(self) -> None:
        """
        Generuje przykładowe nieobecności pracowników (urlopy, zwolnienia).

        Symuluje realistyczne scenariusze:
        - Urlopy wypoczynkowe zaplanowane z wyprzedzeniem
        - Zwolnienia lekarskie z krótkim okresem
        - Różne statusy zatwierdzenia
        """
        if not self.employees or not self.manager:
            return

        self.stdout.write(" Generowanie nieobecności pracowników...")

        licznik_nieobecnosci = 0

        # Urlop wypoczynkowy (przyszły)
        if len(self.employees) > 0:
            TimeOff.objects.create(
                employee=self.employees[0],
                date_from=self.now.date() + timedelta(days=14),
                date_to=self.now.date() + timedelta(days=21),
                status=TimeOff.Status.APPROVED,
                type=TimeOff.Type.VACATION,
                reason="Zaplanowany urlop wypoczynkowy - wyjazd zagraniczny.",
                approved_by=self.manager,
                approved_at=self.now - timedelta(days=30),
            )
            licznik_nieobecnosci += 1

        # Zwolnienie lekarskie (przeszłe)
        if len(self.employees) > 1:
            TimeOff.objects.create(
                employee=self.employees[1],
                date_from=self.now.date() - timedelta(days=7),
                date_to=self.now.date() - timedelta(days=4),
                status=TimeOff.Status.APPROVED,
                type=TimeOff.Type.SICK_LEAVE,
                reason="Zwolnienie lekarskie L4.",
                approved_by=self.manager,
                approved_at=self.now - timedelta(days=7),
            )
            licznik_nieobecnosci += 1

        # Urlop na żądanie (oczekujący)
        if len(self.employees) > 2:
            TimeOff.objects.create(
                employee=self.employees[2],
                date_from=self.now.date() + timedelta(days=3),
                date_to=self.now.date() + timedelta(days=3),
                status=TimeOff.Status.PENDING,
                type=TimeOff.Type.VACATION,
                reason="Urlop na żądanie - sprawy osobiste.",
                approved_by=None,
                approved_at=None,
            )
            licznik_nieobecnosci += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"  ✓ Dodano {licznik_nieobecnosci} rekordów nieobecności"
            )
        )

    def _seeduj_wizyty(self) -> None:
        """
        Generuje kompleksowy zestaw wizyt w różnych statusach i okresach czasu.

        Tworzy wizyty:
        - Historyczne (ostatnie 30 dni) - zakończone, anulowane, no-show
        - Bieżące (dzisiaj) - w trakcie realizacji, potwierdzone
        - Przyszłe (kolejne 14 dni) - oczekujące, potwierdzone

        Zapewnia realistyczne rozkłady godzinowe i walidację kolizji czasowych.
        """
        if not self.employees or not self.clients or not self.services:
            return

        self.stdout.write("Generowanie wizyt w różnych statusach...")

        # SEKCJA 1: Wizyty historyczne (ostatnie 30 dni)
        dni_historyczne = list(range(1, 31))
        for dzien_temu in tqdm(dni_historyczne, desc="Wizyty historyczne"):
            # 2-3 wizyty dziennie w przeszłości
            for _ in range(random.randint(2, 3)):
                wizyta = self._utworz_wizyte_z_walidacja(
                    klient=random.choice(self.clients),
                    pracownik=random.choice(self.employees),
                    usluga=random.choice(self.services),
                    data_bazowa=self.now - timedelta(days=dzien_temu),
                    godzina=random.choice([9, 10, 11, 13, 14, 15, 16, 17]),
                    status=random.choice([
                        Appointment.Status.COMPLETED,
                        Appointment.Status.COMPLETED,
                        Appointment.Status.COMPLETED,
                        Appointment.Status.CANCELLED,
                        Appointment.Status.NO_SHOW,
                    ]),
                    kanal_rezerwacji=random.choice(["online", "phone", "walk_in"]),
                    notatka_wewnetrzna="Wizyta historyczna - dane demonstracyjne.",
                )
                if wizyta:
                    self.appointments.append(wizyta)
                    self.stats.wizyty_utworzone += 1

        # SEKCJA 2: Wizyty dzisiejsze
        for przesuniecie_godzin in [-2, 0, 2, 4]:
            wizyta = self._utworz_wizyte_z_walidacja(
                klient=random.choice(self.clients),
                pracownik=random.choice(self.employees),
                usluga=random.choice(self.services),
                data_bazowa=self.now,
                godzina=max(9, min(17, self.now.hour + przesuniecie_godzin)),
                status=(
                    Appointment.Status.IN_PROGRESS
                    if przesuniecie_godzin == -2
                    else Appointment.Status.CONFIRMED
                ),
                kanal_rezerwacji="online",
                notatka_wewnetrzna="Wizyta bieżąca - dzisiaj.",
            )
            if wizyta:
                self.appointments.append(wizyta)
                self.stats.wizyty_utworzone += 1

        # SEKCJA 3: Wizyty przyszłe (kolejne 14 dni)
        dni_przyszle = [1, 2, 3, 5, 7, 9, 11, 14]
        for dzien_naprzod in tqdm(dni_przyszle, desc="Wizyty przyszłe"):
            # 3-5 wizyt dziennie w przyszłości
            for _ in range(random.randint(3, 5)):
                wizyta = self._utworz_wizyte_z_walidacja(
                    klient=random.choice(self.clients),
                    pracownik=random.choice(self.employees),
                    usluga=random.choice(self.services),
                    data_bazowa=self.now + timedelta(days=dzien_naprzod),
                    godzina=random.choice([9, 10, 11, 13, 14, 15, 16, 17]),
                    status=random.choice([
                        Appointment.Status.PENDING,
                        Appointment.Status.CONFIRMED,
                        Appointment.Status.CONFIRMED,
                    ]),
                    kanal_rezerwacji="online",
                    notatka_wewnetrzna="Wizyta przyszła - zaplanowana.",
                    notatka_klienta="Proszę o delikatne wykonanie.",
                )
                if wizyta:
                    self.appointments.append(wizyta)
                    self.stats.wizyty_utworzone += 1

        # Post-processing: uzupełnienie szczegółów dla specjalnych statusów
        self._uzupelnij_szczegoly_wizyt()

        self.stdout.write(
            self.style.SUCCESS(
                f" Utworzono {len(self.appointments)} wizyt"
            )
        )

    def _utworz_wizyte_z_walidacja(
        self,
        klient: Client,
        pracownik: Employee,
        usluga: Service,
        data_bazowa: datetime,
        godzina: int,
        status: str,
        kanal_rezerwacji: str,
        notatka_wewnetrzna: str,
        notatka_klienta: str = "",
    ) -> Optional[Appointment]:
        """
        Tworzy wizytę z pełną walidacją kolizji czasowych.

        Args:
            klient: Profil klienta
            pracownik: Profil pracownika
            usluga: Wybrana usługa
            data_bazowa: Bazowa data/czas dla wizyty
            godzina: Godzina rozpoczęcia (0-23)
            status: Status wizyty
            kanal_rezerwacji: Kanał przez który dokonano rezerwacji
            notatka_wewnetrzna: Notatka wewnętrzna dla personelu
            notatka_klienta: Notatka/życzenia klienta

        Returns:
            Utworzony obiekt Appointment lub None w przypadku kolizji
        """
        start = data_bazowa.replace(
            hour=godzina,
            minute=0,
            second=0,
            microsecond=0,
        )
        end = start + usluga.duration

        # Walidacja kolizji czasowych
        if not self._czy_slot_wolny(pracownik, start, end):
            logger.debug(
                "Pominięto wizytę - kolizja czasowa (pracownik=%s, start=%s)",
                pracownik.id,
                start,
            )
            return None

        try:
            appointment = Appointment.objects.create(
                client=klient,
                employee=pracownik,
                service=usluga,
                start=start,
                end=end,
                status=status,
                booking_channel=kanal_rezerwacji,
                internal_notes=notatka_wewnetrzna,
                client_notes=notatka_klienta,
            )
            return appointment
        except Exception as e:
            logger.error(
                "Błąd podczas tworzenia wizyty: %s (pracownik=%s, klient=%s)",
                e,
                pracownik.id,
                klient.id,
            )
            return None

    def _czy_slot_wolny(
        self, pracownik: Employee, start: datetime, end: datetime
    ) -> bool:
        """
        Sprawdza czy pracownik ma wolny slot w podanym przedziale czasowym.

        Args:
            pracownik: Profil pracownika
            start: Początek przedziału
            end: Koniec przedziału

        Returns:
            True jeśli slot jest wolny, False jeśli występuje kolizja
        """
        return not Appointment.objects.filter(
            employee=pracownik,
            start__lt=end,
            end__gt=start,
        ).exists()

    def _uzupelnij_szczegoly_wizyt(self) -> None:
        """
        Uzupełnia dodatkowe szczegóły dla wizyt w specjalnych statusach.

        Obsługuje:
        - Wizyty anulowane: ustawia powód anulowania, osobę anulującą, datę
        - Wizyty no-show: dodaje odpowiedni powód niestawienia się
        """
        for wizyta in self.appointments:
            # Obsługa wizyt anulowanych
            if wizyta.status == Appointment.Status.CANCELLED:
                if wizyta.client and not wizyta.cancelled_by:
                    wizyta.cancelled_by = random.choice([
                        wizyta.client.user,
                        self.manager,
                    ])
                    wizyta.cancelled_at = wizyta.start - timedelta(
                        hours=random.randint(3, 48)
                    )
                    wizyta.cancellation_reason = random.choice([
                        "Nagła zmiana planów - sprawy rodzinne",
                        "Choroba - konieczność przełożenia terminu",
                        "Kolizja z innym zobowiązaniem",
                        "Trudności w dotarciu - problemy komunikacyjne",
                    ])
                    wizyta.save()

            # Obsługa wizyt no-show
            elif wizyta.status == Appointment.Status.NO_SHOW:
                wizyta.cancellation_reason = (
                    "Klient nie stawił się na umówioną wizytę "
                    "bez wcześniejszego poinformowania."
                )
                wizyta.save()

    def _seeduj_notatki(self) -> None:
        """
        Dodaje notatki wewnętrzne i dla klientów do wybranych wizyt.

        Notatki mogą zawierać:
        - Preferencje klienta
        - Uwagi techniczne dla pracowników
        - Historia wcześniejszych zabiegów
        - Specjalne życzenia lub ograniczenia
        """
        if not self.appointments:
            return

        self.stdout.write("📝 Dodawanie notatek do wizyt...")

        przyklady_notatek = [
            "Klientka preferuje spokojne, naturalne kolory. Unikać intensywnych zmian.",
            "Uczulenie na niektóre składniki - zawsze sprawdzić skład produktów.",
            "Wrażliwa skóra - używać delikatnych preparatów bez alkoholu.",
            "Preferuje ciche zabiegi bez rozmów - klientka ceni atmosferę relaksu.",
            "Wcześniej były problemy z utrzymaniem koloru - użyć wzmocnionej formuły.",
            "VIP - zawsze oferować kawę/herbatę, zapewnić maksymalny komfort.",
        ]

        licznik_notatek = 0
        # Dodaj notatki do 30% wizyt
        for wizyta in random.sample(
            self.appointments, min(30, len(self.appointments))
        ):
            Note.objects.create(
                appointment=wizyta,
                client=wizyta.client,
                author=random.choice([wizyta.employee.user, self.manager]),
                content=random.choice(przyklady_notatek),
                visible_for_client=random.choice([False, False, True]),
            )
            licznik_notatek += 1
            self.stats.logi_audytu_utworzone += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"  ✓ Dodano {licznik_notatek} notatek do wizyt"
            )
        )

    def _seeduj_platnosci_i_faktury(self) -> None:
        """
        Generuje płatności i faktury dla wizyt zgodnie z ich statusem.

        Obsługuje różne scenariusze:
        - Wizyty zakończone: pełna płatność + opcjonalny napiwek + faktura
        - Wizyty potwierdzone: zaliczka 30%
        - Wizyty no-show: utracona zaliczka

        Zapewnia spójność finansową i generuje odpowiednie dokumenty księgowe.
        """
        if not self.appointments:
            return

        self.stdout.write(" Generowanie płatności i faktur...")

        ustawienia = SystemSettings.load()

        for wizyta in tqdm(self.appointments, desc="Przetwarzanie płatności"):
            try:
                if wizyta.status == Appointment.Status.COMPLETED:
                    self._przetwórz_platnosc_zakonczona(wizyta, ustawienia)
                elif wizyta.status in [
                    Appointment.Status.PENDING,
                    Appointment.Status.CONFIRMED,
                ]:
                    self._przetwórz_zaliczke(wizyta)
                elif wizyta.status == Appointment.Status.NO_SHOW:
                    self._przetwórz_utracona_zaliczke(wizyta)
            except Exception as e:
                logger.error(
                    "Błąd podczas przetwarzania płatności dla wizyty %s: %s",
                    wizyta.id,
                    e,
                )

        self.stdout.write(
            self.style.SUCCESS(
                f" Utworzono {self.stats.platnosci_utworzone} płatności "
                f"i {self.stats.faktury_utworzone} faktur"
            )
        )

    def _przetwórz_platnosc_zakonczona(
        self, wizyta: Appointment, ustawienia: SystemSettings
    ) -> None:
        """Przetwarza pełną płatność dla zakończonej wizyty."""
        kwota_bazowa = wizyta.service.price

        # Płatność główna
        if not Payment.objects.filter(
            appointment=wizyta, type=Payment.Type.FULL
        ).exists():
            payment = Payment.objects.create(
                appointment=wizyta,
                amount=kwota_bazowa,
                status=Payment.Status.PAID,
                method=random.choice([
                    Payment.Method.CARD,
                    Payment.Method.CASH,
                    Payment.Method.TRANSFER,
                ]),
                type=Payment.Type.FULL,
                paid_at=wizyta.end + timedelta(minutes=random.randint(2, 10)),
                reference=f"PAY-{wizyta.id:06d}",
            )
            self.stats.platnosci_utworzone += 1

            # Napiwek (40% szans)
            if random.random() < 0.40:
                kwota_napiwku = random.choice([
                    Decimal("10.00"),
                    Decimal("20.00"),
                    Decimal("30.00"),
                ])
                Payment.objects.create(
                    appointment=wizyta,
                    amount=kwota_napiwku,
                    status=Payment.Status.PAID,
                    method=payment.method,
                    type=Payment.Type.TIP,
                    paid_at=wizyta.end + timedelta(minutes=random.randint(2, 10)),
                    reference=f"TIP-{wizyta.id:06d}",
                )
                self.stats.platnosci_utworzone += 1

        # Faktura
        if not Invoice.objects.filter(appointment=wizyta).exists():
            stawka_vat = ustawienia.default_vat_rate
            kwota_vat, kwota_brutto = calculate_vat(kwota_bazowa, stawka_vat)

            Invoice.objects.create(
                appointment=wizyta,
                client=wizyta.client,
                client_name=wizyta.client.get_full_name() if wizyta.client else "Klient indywidualny",
                client_tax_id="",
                net_amount=kwota_bazowa,
                vat_rate=stawka_vat,
                vat_amount=kwota_vat,
                gross_amount=kwota_brutto,
                issue_date=wizyta.end.date(),
                sale_date=wizyta.start.date(),
                due_date=wizyta.end.date() + timedelta(days=14),
                paid_date=wizyta.end.date(),
                status=Invoice.Status.PAID,
                is_paid=True,
            )
            self.stats.faktury_utworzone += 1

    def _przetwórz_zaliczke(self, wizyta: Appointment) -> None:
        """Przetwarza płatność zaliczki dla potwierdzonej wizyty."""
        kwota_zaliczki = (wizyta.service.price * Decimal("0.30")).quantize(
            Decimal("0.01")
        )

        if not Payment.objects.filter(
            appointment=wizyta, type=Payment.Type.DEPOSIT
        ).exists():
            Payment.objects.create(
                appointment=wizyta,
                amount=kwota_zaliczki,
                status=Payment.Status.DEPOSIT,
                method=random.choice([
                    Payment.Method.TRANSFER,
                    Payment.Method.CARD,
                ]),
                type=Payment.Type.DEPOSIT,
                paid_at=wizyta.start - timedelta(days=random.randint(1, 5)),
                reference=f"DEP-{wizyta.id:06d}",
            )
            self.stats.platnosci_utworzone += 1

    def _przetwórz_utracona_zaliczke(self, wizyta: Appointment) -> None:
        """Przetwarza utraconą zaliczkę dla wizyty no-show."""
        kwota_zaliczki = (wizyta.service.price * Decimal("0.30")).quantize(
            Decimal("0.01")
        )

        if not Payment.objects.filter(
            appointment=wizyta,
            type=Payment.Type.DEPOSIT,
            status=Payment.Status.FORFEITED,
        ).exists():
            Payment.objects.create(
                appointment=wizyta,
                amount=kwota_zaliczki,
                status=Payment.Status.FORFEITED,
                method=Payment.Method.CARD,
                type=Payment.Type.DEPOSIT,
                paid_at=wizyta.start + timedelta(hours=random.randint(1, 3)),
                reference=f"FORF-{wizyta.id:06d}",
            )
            self.stats.platnosci_utworzone += 1

    def _aktualizuj_metryki(self) -> None:
        """
        Aktualizuje metryki statystyczne dla klientów, pracowników i usług.

        Przelicza:
        - Liczbę wizyt i łączne wydatki dla klientów
        - Liczbę zrealizowanych wizyt i średnie oceny dla pracowników
        - Liczbę rezerwacji dla usług
        """
        self.stdout.write(" Aktualizacja metryk statystycznych...")

        # Metryki klientów
        for klient in self.clients:
            zakonczone = Appointment.objects.filter(
                client=klient,
                status=Appointment.Status.COMPLETED,
            )
            klient.visits_count = zakonczone.count()
            klient.total_spent_amount = (
                Payment.objects.filter(
                    appointment__client=klient,
                    status__in=[
                        Payment.Status.PAID,
                        Payment.Status.DEPOSIT,
                    ],
                ).aggregate(total=Sum("amount"))["total"]
                or Decimal("0.00")
            )
            klient.save()

        # Metryki pracowników
        for pracownik in self.employees:
            zakonczone = Appointment.objects.filter(
                employee=pracownik,
                status=Appointment.Status.COMPLETED,
            )
            pracownik.appointments_count = zakonczone.count()
            # Symulacja średniej oceny (realistyczne wartości)
            if zakonczone.exists():
                pracownik.average_rating = Decimal(
                    str(random.uniform(4.3, 4.95))
                ).quantize(Decimal("0.01"))
            pracownik.save()

        # Metryki usług
        for usluga in self.services:
            usluga.reservations_count = Appointment.objects.filter(
                service=usluga
            ).count()
            usluga.save(update_fields=["reservations_count"])

        self.stdout.write(self.style.SUCCESS("  ✓ Metryki zaktualizowane"))

    def _seeduj_powiadomienia(self) -> None:
        """
        Generuje powiadomienia różnych typów dla klientów.

        Typy powiadomień:
        - Przypomnienia o nadchodzących wizytach (24h przed)
        - Potwierdzenia anulowania wizyt
        - Powiadomienia promocyjne
        - Podziękowania po wizycie
        """
        if not self.appointments or not self.clients:
            return

        self.stdout.write(" Generowanie powiadomień...")

        # Przypomnienia o nadchodzących wizytach
        nadchodzace = [
            w for w in self.appointments
            if w.start > self.now and w.status in [
                Appointment.Status.PENDING,
                Appointment.Status.CONFIRMED,
            ]
        ]

        for wizyta in nadchodzace[:10]:  # Limit 10 przypomnień
            if wizyta.client:
                Notification.objects.create(
                    client=wizyta.client,
                    appointment=wizyta,
                    type=Notification.Type.REMINDER,
                    channel=random.choice([
                        Notification.Channel.EMAIL,
                        Notification.Channel.SMS,
                    ]),
                    status=Notification.Status.PENDING,
                    subject="Przypomnienie o wizycie - Beauty Salon Management System",
                    content=(
                        f"Dzień dobry {wizyta.client.first_name},\n\n"
                        f"Przypominamy o Twojej wizycie:\n"
                        f"• Data: {wizyta.start.strftime('%d.%m.%Y')}\n"
                        f"• Godzina: {wizyta.start.strftime('%H:%M')}\n"
                        f"• Usługa: {wizyta.service.name}\n"
                        f"• Pracownik: {wizyta.employee.get_full_name()}\n\n"
                        f"Do zobaczenia!"
                    ),
                    scheduled_at=wizyta.start - timedelta(hours=24),
                )
                self.stats.powiadomienia_utworzone += 1

        # Powiadomienia o anulowaniu
        anulowane = [
            w for w in self.appointments
            if w.status == Appointment.Status.CANCELLED
        ]

        if anulowane:
            wizyta = anulowane[0]
            if wizyta.client:
                Notification.objects.create(
                    client=wizyta.client,
                    appointment=wizyta,
                    type=Notification.Type.CANCELLATION,
                    channel=Notification.Channel.EMAIL,
                    status=Notification.Status.SENT,
                    subject="Potwierdzenie anulowania wizyty",
                    content=(
                        f"Dzień dobry {wizyta.client.first_name},\n\n"
                        f"Potwierdzamy anulowanie Twojej wizyty:\n"
                        f"• Data: {wizyta.start.strftime('%d.%m.%Y %H:%M')}\n"
                        f"• Usługa: {wizyta.service.name}\n"
                        f"• Powód: {wizyta.cancellation_reason or 'brak podanego powodu'}\n\n"
                        f"Zapraszamy do umówienia się na inny termin."
                    ),
                    scheduled_at=wizyta.cancelled_at or self.now,
                    sent_at=wizyta.cancelled_at or self.now,
                )
                self.stats.powiadomienia_utworzone += 1

        # Powiadomienia promocyjne dla wybranych klientów
        for klient in self.clients[:5]:
            Notification.objects.create(
                client=klient,
                appointment=None,
                type=Notification.Type.PROMOTION,
                channel=Notification.Channel.EMAIL,
                status=Notification.Status.SENT,
                subject="Ekskluzywna promocja tylko dla Ciebie!",
                content=(
                    f"Dzień dobry {klient.first_name},\n\n"
                    f"Specjalnie dla Ciebie przygotowaliśmy wyjątkową ofertę:\n\n"
                    f"-25% na wybrane zabiegi na twarz\n"
                    f"-20% na masaż relaksacyjny\n"
                    f"Darmowa konsultacja kosmetologiczna\n\n"
                    f"Oferta ważna do końca miesiąca!\n"
                    f"Umów się już dziś: beauty-salon.pl"
                ),
                scheduled_at=self.now - timedelta(days=2),
                sent_at=self.now - timedelta(days=2),
            )
            self.stats.powiadomienia_utworzone += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Utworzono {self.stats.powiadomienia_utworzone} powiadomień"
            )
        )

    def _seeduj_zasoby_mediow(self) -> None:
        """
        Generuje zasoby multimedialne (portfolio pracowników).

        Dla każdego pracownika tworzy:
        - Zdjęcia przed/po zabiegach
        - Portfolio prac
        - Inne materiały promocyjne
        """
        if not self.employees:
            return

        self.stdout.write("Generowanie zasobów multimedialnych...")

        typy_mediow = [
            MediaAsset.Type.BEFORE,
            MediaAsset.Type.AFTER,
            MediaAsset.Type.OTHER,
        ]

        for pracownik in self.employees:
            for idx, typ in enumerate(typy_mediow):
                # Symulacja pliku (w rzeczywistości byłby to prawdziwy plik)
                dummy_content = ContentFile(
                    b"DEMO-IMAGE-DATA-FOR-ENGINEERING-THESIS",
                    name=f"portfolio_{pracownik.id}_{idx + 1}.jpg",
                )

                MediaAsset.objects.create(
                    employee=pracownik,
                    name=f"Portfolio {pracownik.first_name} - Zdjęcie {idx + 1}",
                    file=dummy_content,
                    file_name=f"portfolio_{pracownik.id}_{idx + 1}.jpg",
                    file_url=f"https://picsum.photos/seed/emp{pracownik.id}_{idx}/1200/800",
                    mime_type="image/jpeg",
                    type=typ,
                    description=(
                        f"Profesjonalne zdjęcie {typ} demonstrujące "
                        f"umiejętności {pracownik.first_name}."
                    ),
                    is_active=True,
                    is_private=False,
                )
                self.stats.media_utworzone += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Utworzono {self.stats.media_utworzone} zasobów multimedialnych"
            )
        )

    def _seeduj_migawki_statystyk(self) -> None:
        """
        Generuje migawki statystyk dla raportowania.

        Tworzy podsumowania:
        - Tygodniowe (ostatnie 7 dni)
        - Miesięczne (ostatnie 30 dni)

        Zawiera dane o wizytach, przychodach, klientach i wydajności.
        """
        self.stdout.write("Generowanie migawek statystycznych...")

        data_koncowa = self.now.date()

        # Migawka miesięczna (30 dni)
        data_poczatkowa_30 = data_koncowa - timedelta(days=30)

        przychod_total_30 = (
            Payment.objects.filter(
                paid_at__date__gte=data_poczatkowa_30,
                paid_at__date__lte=data_koncowa,
                status__in=[
                    Payment.Status.PAID,
                    Payment.Status.DEPOSIT,
                ],
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        przychod_zaliczki_30 = (
            Payment.objects.filter(
                paid_at__date__gte=data_poczatkowa_30,
                paid_at__date__lte=data_koncowa,
                status=Payment.Status.DEPOSIT,
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        StatsSnapshot.objects.create(
            period=StatsSnapshot.Period.MONTHLY,
            date_from=data_poczatkowa_30,
            date_to=data_koncowa,
            total_visits=Appointment.objects.filter(
                start__date__gte=data_poczatkowa_30,
                start__date__lte=data_koncowa,
            ).count(),
            completed_visits=Appointment.objects.filter(
                status=Appointment.Status.COMPLETED,
                start__date__gte=data_poczatkowa_30,
                start__date__lte=data_koncowa,
            ).count(),
            cancellations=Appointment.objects.filter(
                status=Appointment.Status.CANCELLED,
                start__date__gte=data_poczatkowa_30,
                start__date__lte=data_koncowa,
            ).count(),
            no_shows=Appointment.objects.filter(
                status=Appointment.Status.NO_SHOW,
                start__date__gte=data_poczatkowa_30,
                start__date__lte=data_koncowa,
            ).count(),
            revenue_total=przychod_total_30,
            revenue_deposits=przychod_zaliczki_30,
            new_clients=len(self.clients),
            returning_clients=max(0, len(self.clients) - 5),
            employees_occupancy_avg=Decimal("68.50"),
            extra_metrics={
                "source": "seed_database_v2",
                "note": "Dane demonstracyjne - praca inżynierska",
                "generated_at": self.now.isoformat(),
            },
        )

        # Migawka tygodniowa (7 dni)
        data_poczatkowa_7 = data_koncowa - timedelta(days=7)

        przychod_total_7 = (
            Payment.objects.filter(
                paid_at__date__gte=data_poczatkowa_7,
                paid_at__date__lte=data_koncowa,
                status__in=[
                    Payment.Status.PAID,
                    Payment.Status.DEPOSIT,
                ],
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        przychod_zaliczki_7 = (
            Payment.objects.filter(
                paid_at__date__gte=data_poczatkowa_7,
                paid_at__date__lte=data_koncowa,
                status=Payment.Status.DEPOSIT,
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        StatsSnapshot.objects.create(
            period=StatsSnapshot.Period.WEEKLY,
            date_from=data_poczatkowa_7,
            date_to=data_koncowa,
            total_visits=Appointment.objects.filter(
                start__date__gte=data_poczatkowa_7,
                start__date__lte=data_koncowa,
            ).count(),
            completed_visits=Appointment.objects.filter(
                status=Appointment.Status.COMPLETED,
                start__date__gte=data_poczatkowa_7,
                start__date__lte=data_koncowa,
            ).count(),
            cancellations=Appointment.objects.filter(
                status=Appointment.Status.CANCELLED,
                start__date__gte=data_poczatkowa_7,
                start__date__lte=data_koncowa,
            ).count(),
            no_shows=Appointment.objects.filter(
                status=Appointment.Status.NO_SHOW,
                start__date__gte=data_poczatkowa_7,
                start__date__lte=data_koncowa,
            ).count(),
            revenue_total=przychod_total_7,
            revenue_deposits=przychod_zaliczki_7,
            new_clients=len(self.clients),
            returning_clients=max(0, len(self.clients) - 8),
            employees_occupancy_avg=Decimal("74.20"),
            extra_metrics={
                "source": "seed_database_v2",
                "note": "Dane demonstracyjne - praca inżynierska",
                "generated_at": self.now.isoformat(),
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                "  ✓ Utworzono migawki statystyk (tygodniową i miesięczną)"
            )
        )

    def _seeduj_raporty_pdf(self) -> None:
        """
        Generuje przykładowe raporty PDF.

        Tworzy demonstracyjne raporty finansowe z symulowaną zawartością.
        W rzeczywistym systemie byłyby to prawdziwe dokumenty PDF.
        """
        if not self.manager:
            return

        self.stdout.write(" Generowanie raportów PDF...")

        data_koncowa = self.now.date()
        data_poczatkowa = data_koncowa - timedelta(days=30)

        # Symulacja zawartości PDF
        pdf_content = (
            b"%PDF-1.4\n"
            b"% Simulated PDF report for demonstration purposes\n"
            b"% System: Beauty Excellence Studio\n"
            b"% Type: Monthly financial report\n"
            b"% Generated: Automatically by seed_database\n"
        )

        pdf_file = ContentFile(
            pdf_content,
            name="raport_miesieczny_demo.pdf",
        )

        ReportPDF.objects.create(
            type=ReportPDF.Type.FINANCIAL,
            title=f"Raport finansowy - {data_poczatkowa} do {data_koncowa}",
            date_from=data_poczatkowa,
            date_to=data_koncowa,
            data_od=data_poczatkowa,
            data_do=data_koncowa,
            generated_by=self.manager,
            file=pdf_file,
            file_path="reports/raport_miesieczny_demo.pdf",
            file_size=len(pdf_content),
            parameters={
                "period": "last_30_days",
                "include_tips": True,
                "include_deposits": True,
                "group_by_service": True,
                "generated_from_seed": True,
            },
            notes=(
                "Raport wygenerowany automatycznie w ramach seedowania bazy danych. "
                "Zawiera podsumowanie finansowe działalności salonu za ostatnie 30 dni."
            ),
        )

        self.stdout.write(
            self.style.SUCCESS("Utworzono przykładowy raport PDF")
        )

    def _seeduj_logi_audytu(self) -> None:
        """
        Generuje wpisy do dziennika audytu systemowego.

        Rejestruje:
        - Operacje systemowe (inicjalizacja bazy)
        - Zmiany w wizytach
        - Operacje finansowe (utracone zaliczki)
        - Inne znaczące zdarzenia
        """
        if not self.manager:
            return

        self.stdout.write("Generowanie logów audytu...")

        # Log inicjalizacji systemu
        AuditLog.objects.create(
            type=AuditLog.Type.SYSTEM_OPERATION,
            level=AuditLog.Level.INFO,
            user=self.manager,
            message=(
                "Inicjalizacja bazy danych danymi demonstracyjnymi. "
                "Wygenerowano kompletny zestaw danych dla celów pracy inżynierskiej."
            ),
            adres_ip="127.0.0.1",
            user_agent="seed_database_v2.0/engineering-thesis",
            entity_type="system",
            entity_id="seed_operation",
            metadata={
                "employees_created": self.stats.pracownicy_utworzeni,
                "clients_created": self.stats.klienci_utworzeni,
                "appointments_created": self.stats.wizyty_utworzone,
                "timestamp": self.now.isoformat(),
            },
        )
        self.stats.logi_audytu_utworzone += 1

        # Logi dla przykładowych wizyt
        if self.appointments:
            for wizyta in self.appointments[:5]:
                AuditLog.objects.create(
                    type=AuditLog.Type.APPOINTMENT_CHANGE,
                    level=AuditLog.Level.INFO,
                    user=wizyta.employee.user,
                    message=f"Utworzono wizytę demonstracyjną #{wizyta.id}",
                    adres_ip="127.0.0.1",
                    user_agent="seed_database_v2.0/engineering-thesis",
                    entity_type="appointment",
                    entity_id=str(wizyta.id),
                    metadata={
                        "status": wizyta.status,
                        "service": wizyta.service.name,
                        "client": wizyta.client.get_full_name() if wizyta.client else "N/A",
                        "start": wizyta.start.isoformat(),
                    },
                )
                self.stats.logi_audytu_utworzone += 1

        # Log dla utraconych zaliczek
        utracone_zaliczki = Payment.objects.filter(
            status=Payment.Status.FORFEITED
        )
        if utracone_zaliczki.exists():
            platnosc = utracone_zaliczki.first()
            AuditLog.objects.create(
                type=AuditLog.Type.PAYMENT_DEPOSIT_FORFEITED,
                level=AuditLog.Level.WARNING,
                user=self.manager,
                message=f"Zaliczka #{platnosc.id} została utracona (no-show)",
                adres_ip="127.0.0.1",
                user_agent="seed_database_v2.0/engineering-thesis",
                entity_type="payment",
                entity_id=str(platnosc.id),
                metadata={
                    "amount": str(platnosc.amount),
                    "appointment_id": str(platnosc.appointment_id),
                },
            )
            self.stats.logi_audytu_utworzone += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Utworzono {self.stats.logi_audytu_utworzone} wpisów audytu"
            )
        )

    def _wyswietl_podsumowanie(self) -> None:
        """
        Wyświetla szczegółowe podsumowanie operacji seedowania.

        Zawiera:
        - Statystyki utworzonych rekordów
        - Dane logowania do systemu
        - Informacje o bezpieczeństwie
        """
        self.stdout.write("")
        self.stdout.write(self.stats.wyswietl_podsumowanie())

        self.stdout.write(self.style.SUCCESS("DANE DOSTĘPOWE DO SYSTEMU"))
        self.stdout.write("=" * 80)
        self.stdout.write("")
        self.stdout.write(" KONTO MANAGERA:")
        self.stdout.write("   Email:    manager@beauty-salon.pl")
        self.stdout.write("   Hasło:    AdminDemo2024!")
        self.stdout.write("")
        self.stdout.write(" KONTA PRACOWNIKÓW:")
        self.stdout.write("   Email:    [imie.nazwisko]@beauty-salon.pl")
        self.stdout.write("   Hasło:    PracownikDemo2024!")
        self.stdout.write("")
        self.stdout.write(" KONTA KLIENTÓW:")
        self.stdout.write("   Email:    [zgodnie z listą w bazie]")
        self.stdout.write("   Hasło:    KlientDemo2024!")
        self.stdout.write("")
        self.stdout.write("=" * 80)
        self.stdout.write(
            self.style.WARNING(
                "\n UWAGA BEZPIECZEŃSTWA:\n"
                "Powyższe dane logowania są przeznaczone WYŁĄCZNIE do środowisk\n"
                "deweloperskich i demonstracyjnych."
            )
        )
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                " Seedowanie bazy danych zakończone sukcesem!\n"
            )
        )

    def _wyczysc_dane_demo(self) -> None:
        """
        Usuwa wszystkie dane demonstracyjne z bazy danych.

        Operacja wykonywana jest w odpowiedniej kolejności, aby
        zachować integralność referencyjną i uniknąć błędów.
        """
        self.stdout.write("")
        self.stdout.write(self.style.WARNING(" Usuwanie istniejących danych demo..."))
        self.stdout.write("")

        # Lista modeli w kolejności usuwania (uwzględnia zależności FK)
        modele_do_wyczyszczenia: List[Tuple[ModelBase, str]] = [
            (Note, "Notatki"),
            (Notification, "Powiadomienia"),
            (MediaAsset, "Zasoby mediów"),
            (Payment, "Płatności"),
            (Invoice, "Faktury"),
            (Appointment, "Wizyty"),
            (TimeOff, "Nieobecności"),
            (Schedule, "Harmonogramy"),
            (StatsSnapshot, "Migawki statystyk"),
            (ReportPDF, "Raporty PDF"),
            (AuditLog, "Logi audytu"),
            (Service, "Usługi"),
            (Client, "Klienci"),
            (Employee, "Pracownicy"),
        ]

        for model, nazwa in modele_do_wyczyszczenia:
            ilosc_usunietych = model.objects.all().delete()[0]  # type: ignore[attr-defined]
            self.stdout.write(f"  • {nazwa:.<30} {ilosc_usunietych:>6} rekordów")

        # Usunięcie użytkowników systemowych
        ilosc_userow = User.objects.filter(
            role__in=[
                User.RoleChoices.MANAGER,
                User.RoleChoices.EMPLOYEE,
                User.RoleChoices.CLIENT,
            ]
        ).delete()[0]
        self.stdout.write(
            f"  • {'Użytkownicy systemowi':.<30} {ilosc_userow:>6} rekordów"
        )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(" Dane demo zostały usunięte pomyślnie"))
        self.stdout.write("")