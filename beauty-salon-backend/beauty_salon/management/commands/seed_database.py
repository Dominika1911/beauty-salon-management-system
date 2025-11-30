import random
from datetime import timedelta, datetime  # Zapewnienie, że datetime jest zaimportowane
from decimal import Decimal
import logging
from typing import Any, Optional, List, Callable, Iterable, Dict

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, QuerySet
from django.core.files.base import ContentFile
from django.db.models.base import ModelBase  # Import dla type-hinting menadżerów

from beauty_salon.models import (
    Service,
    Employee,
    Client,
    Schedule,
    TimeOff,
    Appointment,
    Note,
    Payment,
    Invoice,
    MediaAsset,
    Notification,
    SystemSettings,
    AuditLog,
    StatsSnapshot,
    ReportPDF,
)

from beauty_salon.utils import calculate_vat

# Opcjonalny progress bar – jeśli brak tqdm, skrypt dalej działa normalnie
try:
    from tqdm import tqdm
except ImportError:  # pragma: no cover
    def tqdm(iterable: Iterable[Any], **kwargs: Any) -> Iterable[Any]:  # type: ignore[no-redef]
        return iterable


logger = logging.getLogger(__name__)

User = get_user_model()


class Command(BaseCommand):
    help = "Rozbudowany seed bazy danych dla systemu salonu kosmetycznego (wersja na inżynierkę)."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Usuń istniejące dane demo przed seedowaniem.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Seeduj nawet jeśli w bazie są już dane (bez czyszczenia).",
        )
        parser.add_argument(
            "--clients",
            type=int,
            default=10,
            help=(
                "Docelowa liczba klientów demo (minimum 1). "
                "Powyżej 10 dodatkowi klienci zostaną wygenerowani automatycznie."
            ),
        )

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        clear = options.get("clear")
        force = options.get("force")
        clients_target = max(1, options.get("clients") or 10)

        now = timezone.now()

        self.stdout.write("")
        self.stdout.write("=" * 72)
        self.stdout.write(self.style.SUCCESS("  Beauty Salon – SEED DATABASE (wersja rozszerzona)  "))
        self.stdout.write("=" * 72)

        # 1. Obsługa opcji --clear / --force
        if clear:
            self.clear_demo_data()
        elif not force and (
                Appointment.objects.exists()
                or Client.objects.exists()
                or Employee.objects.exists()
        ):
            self.stdout.write(
                self.style.WARNING(
                    "W bazie są już dane (wizyty/klienci/pracownicy).\n"
                    "Użyj:\n"
                    "  • --clear  żeby usunąć dane demo i zasiej od nowa\n"
                    "  • --force  żeby mimo wszystko dodać kolejne dane\n"
                )
            )
            return

        # =========================================================================
        # 2. SYSTEM SETTINGS
        # =========================================================================
        settings_obj = SystemSettings.load()
        settings_obj.salon_name = "Beauty Studio Demo – Inżynierka"
        settings_obj.address = "ul. Inżynierska 1, 00-001 Warszawa"
        settings_obj.phone = "+48 555 123 456"
        settings_obj.contact_email = "kontakt@inzynierski-salon.demo"
        settings_obj.slot_minutes = 30
        settings_obj.buffer_minutes = 10
        settings_obj.default_vat_rate = Decimal("23.00")
        settings_obj.deposit_policy = {
            "require_deposit": True,
            "default_deposit_percent": 30,
            "free_cancellation_hours": 24,
            "no_show_deposit_forfeit_percent": 100,
            "late_cancellation_deposit_forfeit_percent": 50,
            "forfeit_deposit_on_cancellation": True,
        }
        settings_obj.opening_hours = {
            "Monday": {"open": "09:00", "close": "19:00"},
            "Tuesday": {"open": "09:00", "close": "19:00"},
            "Wednesday": {"open": "09:00", "close": "19:00"},
            "Thursday": {"open": "10:00", "close": "20:00"},
            "Friday": {"open": "09:00", "close": "19:00"},
            "Saturday": {"open": "09:00", "close": "15:00"},
            "Sunday": None,
        }
        settings_obj.is_online_booking_enabled = True
        settings_obj.maintenance_mode = False
        settings_obj.maintenance_message = ""
        settings_obj.save()

        self.stdout.write(self.style.SUCCESS("✓ Ustawienia systemowe zapisane."))

        # =========================================================================
        # 3. USERS – MANAGER + EMPLOYEES
        # =========================================================================
        # UWAGA: dane logowania TYLKO do środowisk demo/testowych.
        # W produkcji użyj bezpiecznych haseł/zmiennych środowiskowych.
        manager = User.objects.create_superuser(
            email="manager@inzynierski-salon.demo",
            password="admin123",
            first_name="Dominika",
            last_name="Manager",
            role=User.RoleChoices.MANAGER,
        )

        employees_def = [
            ("anna.stylist@salon.demo", "Anna", "Kowalska", "+48 555 000 101"),
            ("marta.nails@salon.demo", "Marta", "Wiśniewska", "+48 555 000 102"),
            ("paulina.face@salon.demo", "Paulina", "Zielińska", "+48 555 000 103"),
            ("magda.lashes@salon.demo", "Magda", "Nowicka", "+48 555 000 104"),
            ("karolina.massage@salon.demo", "Karolina", "Mazur", "+48 555 000 105"),
        ]

        employees = []
        for email, first, last, phone in employees_def:
            user = User.objects.create_user(
                email=email,
                password="test1234",
                first_name=first,
                last_name=last,
                role=User.RoleChoices.EMPLOYEE,
            )
            # jeśli masz sygnały – Employee powstanie sam, ale dla pewności:
            employee_profile, _ = Employee.objects.get_or_create(user=user)
            employee_profile.first_name = first
            employee_profile.last_name = last
            employee_profile.phone = phone
            employee_profile.hired_at = now.date() - timedelta(days=random.randint(90, 730))
            employee_profile.is_active = True
            employee_profile.save()
            employees.append(employee_profile)

        self.stdout.write(self.style.SUCCESS(f"✓ Utworzono {len(employees)} pracowników + 1 manager."))

        # =========================================================================
        # 4. USERS – CLIENTS
        # =========================================================================
        base_clients_def = [
            ("klient1@example.com", "Karolina", "Jasińska", "+48 555 111 001"),
            ("klient2@example.com", "Magda", "Kwiatkowska", "+48 555 111 002"),
            ("klient3@example.com", "Joanna", "Lewandowska", "+48 555 111 003"),
            ("klient4@example.com", "Sylwia", "Pawlak", "+48 555 111 004"),
            ("klient5@example.com", "Natalia", "Walczak", "+48 555 111 005"),
            ("klient6@example.com", "Ewelina", "Marciniak", "+48 555 111 006"),
            ("klient7@example.com", "Justyna", "Rutkowska", "+48 555 111 007"),
            ("klient8@example.com", "Aleksandra", "Baran", "+48 555 111 008"),
            ("klient9@example.com", "Paulina", "Duda", "+48 555 111 009"),
            ("klient10@example.com", "Izabela", "Czarnecka", "+48 555 111 010"),
        ]

        clients_def = list(base_clients_def)

        # jeśli ktoś poda więcej niż 10 klientów – generujemy dodatkowych technicznych
        if clients_target > len(clients_def):
            extra_needed = clients_target - len(clients_def)
            for i in range(extra_needed):
                idx = len(clients_def) + 1
                clients_def.append(
                    (
                        f"klient{idx}@example.com",
                        f"Klient{idx}",
                        f"Demo{idx}",
                        f"+48 555 111 {idx:03d}",
                    )
                )

        # przycinamy, jeśli ktoś podał mniej niż 10
        clients_def = clients_def[:clients_target]

        clients = []
        for email, first, last, phone in clients_def:
            user = User.objects.create_user(
                email=email,
                password="client123",
                first_name=first,
                last_name=last,
                role=User.RoleChoices.CLIENT,
            )
            client_profile, _ = Client.objects.get_or_create(user=user)
            client_profile.first_name = first
            client_profile.last_name = last
            client_profile.email = email
            client_profile.phone = phone
            client_profile.marketing_consent = random.choice([True, False])
            client_profile.preferred_contact = random.choice(
                [
                    Client.ContactPreference.EMAIL,
                    Client.ContactPreference.SMS,
                    Client.ContactPreference.PHONE,
                ]
            )
            client_profile.internal_notes = "Klient założony przez seed_database (demo – dane testowe)."
            client_profile.save()
            clients.append(client_profile)

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Utworzono {len(clients)} klientów wraz z kontami użytkowników."
            )
        )

        # =========================================================================
        # 5. SERVICES
        # =========================================================================
        services_def = [
            ("Strzyżenie damskie", "Włosy", Decimal("80.00"), 45, "Strzyżenie z modelowaniem."),
            ("Strzyżenie męskie", "Włosy", Decimal("50.00"), 30, "Strzyżenie męskie z myciem."),
            ("Koloryzacja jednolita", "Włosy", Decimal("180.00"), 120, "Koloryzacja pełna, bez refleksów."),
            ("Baleyage + tonowanie", "Włosy", Decimal("260.00"), 150, "Baleyage, tonowanie, modelowanie."),
            ("Manicure hybrydowy", "Paznokcie", Decimal("100.00"), 60, "Klasyczny manicure hybrydowy."),
            ("Pedicure SPA", "Paznokcie", Decimal("140.00"), 75, "Pedicure z peelingiem i masażem."),
            ("Oczyszczanie manualne", "Twarz", Decimal("160.00"), 75, "Głębokie oczyszczanie cery."),
            ("Mezoterapia bezigłowa", "Twarz", Decimal("220.00"), 60, "Zabieg odżywiający skórę."),
            ("Laminacja rzęs", "Rzęsy", Decimal("150.00"), 70, "Uniesienie i odżywienie rzęs."),
            ("Regulacja i henna brwi", "Brwi", Decimal("70.00"), 30, "Regulacja kształtu + henna."),
            ("Masaż relaksacyjny pleców", "Ciało", Decimal("140.00"), 45, "Relaksacyjny masaż pleców."),
            ("Masaż gorącymi kamieniami", "Ciało", Decimal("220.00"), 80, "Głęboko relaksujący masaż."),
        ]

        services: List[Service] = []
        for name, category, price, minutes, description in services_def:
            service = Service.objects.create(
                name=name,
                category=category,
                price=price,
                duration=timedelta(minutes=minutes),
                description=description,
                is_published=True,
                promotion={},
                image_url=f"https://picsum.photos/seed/service_{len(services) + 1}/600/400",
            )
            services.append(service)

        # Losowe promocje – bardziej elastyczne niż „na sztywno”
        for s in services:
            if random.random() < 0.3:  # 30% szans na aktywną promocję
                s.promotion = {
                    "active": True,
                    "discount_percent": random.choice([10, 15, 20]),
                }
            else:
                s.promotion = {"active": False}
            s.save(update_fields=["promotion"])

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Utworzono {len(services)} usług z przykładowymi (losowymi) promocjami."
            )
        )

        # =========================================================================
        # 6. EMPLOYEE SKILLS
        # =========================================================================
        if employees:
            hair = [s for s in services if s.category == "Włosy"]
            nails = [s for s in services if s.category == "Paznokcie"]
            face = [s for s in services if s.category == "Twarz"]
            brows = [s for s in services if s.category == "Brwi"]
            lashes = [s for s in services if s.category == "Rzęsy"]
            body = [s for s in services if s.category == "Ciało"]

            # Używamy listy + modulo, dzięki czemu działa dla dowolnej liczby pracowników
            skill_patterns = [
                hair + brows,
                nails + face,
                face + brows,
                lashes + brows,
                body + face,
            ]

            for idx, emp in enumerate(employees):
                skills = skill_patterns[idx % len(skill_patterns)]
                emp.skills.set(skills)
                emp.save()

        self.stdout.write(self.style.SUCCESS("✓ Przypisano umiejętności pracownikom."))

        # =========================================================================
        # 7. SCHEDULES
        # =========================================================================
        base_availability: List[Dict[str, str]] = [
            {"day": "Monday", "start": "09:00", "end": "17:00"},
            {"day": "Tuesday", "start": "09:00", "end": "17:00"},
            {"day": "Wednesday", "start": "09:00", "end": "17:00"},
            {"day": "Thursday", "start": "11:00", "end": "19:00"},
            {"day": "Friday", "start": "09:00", "end": "17:00"},
            {"day": "Saturday", "start": "09:00", "end": "14:00"},
        ]
        base_breaks: List[Dict[str, str]] = [
            {"day": "Monday", "start": "13:00", "end": "13:30"},
            {"day": "Tuesday", "start": "13:00", "end": "13:30"},
            {"day": "Wednesday", "start": "13:00", "end": "13:30"},
            {"day": "Thursday", "start": "15:00", "end": "15:30"},
            {"day": "Friday", "start": "13:00", "end": "13:30"},
        ]

        schedules = []
        for emp in employees:
            availability = list(base_availability)
            if emp is employees[-1]:
                availability = [dict(a) for a in availability]
                for a in availability:
                    if a["day"] == "Monday":
                        a["end"] = "15:00"

            schedule = Schedule.objects.create(
                employee=emp,
                status=Schedule.Status.ACTIVE,
                availability_periods=availability,
                breaks=base_breaks,
            )
            schedules.append(schedule)

        self.stdout.write(self.style.SUCCESS(f"✓ Utworzono {len(schedules)} grafików pracy."))

        # =========================================================================
        # 8. TIME OFF
        # =========================================================================
        time_offs = []
        if employees:
            vacation = TimeOff.objects.create(
                employee=employees[0],
                date_from=now.date() + timedelta(days=7),
                date_to=now.date() + timedelta(days=10),
                status=TimeOff.Status.APPROVED,
                type=TimeOff.Type.VACATION,
                reason="Urlop wypoczynkowy – wyjazd nad morze.",
                approved_by=manager,
                approved_at=now,
            )
            time_offs.append(vacation)

            if len(employees) > 1:
                sick = TimeOff.objects.create(
                    employee=employees[1],
                    date_from=now.date() - timedelta(days=5),
                    date_to=now.date() - timedelta(days=3),
                    status=TimeOff.Status.APPROVED,
                    type=TimeOff.Type.SICK_LEAVE,
                    reason="Zwolnienie lekarskie.",
                    approved_by=manager,
                    approved_at=now - timedelta(days=5),
                )
                time_offs.append(sick)

        self.stdout.write(self.style.SUCCESS(f"✓ Dodano {len(time_offs)} nieobecności pracowników."))

        # =========================================================================
        # 9. APPOINTMENTS
        # =========================================================================
        # Używamy listy, która może zawierać None
        appointments_with_none: List[Optional[Appointment]] = []

        if employees and clients and services:
            # Historyczne wizyty (ostatnie 30 dni)
            history_days = [30, 21, 14, 7, 3]
            for days_ago in tqdm(history_days, desc="Tworzenie historycznych wizyt"):
                for _ in range(2):
                    client = random.choice(clients)
                    emp = random.choice(employees)
                    service = random.choice(services)
                    start = (now - timedelta(days=days_ago)).replace(
                        hour=random.choice([9, 11, 13, 15, 17]),
                        minute=0,
                        second=0,
                        microsecond=0,
                    )
                    end = start + service.duration
                    status = random.choice(
                        [
                            Appointment.Status.COMPLETED,
                            Appointment.Status.COMPLETED,
                            Appointment.Status.CANCELLED,
                            Appointment.Status.NO_SHOW,
                        ]
                    )

                    appt = self._create_appointment_if_possible(
                        client=client,
                        emp=emp,
                        service=service,
                        start=start,
                        end=end,
                        status=status,
                        booking_channel=random.choice(["online", "phone", "walk_in"]),
                        internal_notes="Wizyta wygenerowana automatycznie przez seed_database.",
                        client_notes="",
                    )
                    # Dodajemy do listy z None lub Appt
                    appointments_with_none.append(appt)

            # Wizyty „dzisiaj”
            for offset_hours in [-2, 1, 3]:
                client = random.choice(clients)
                emp = random.choice(employees)
                service = random.choice(services)
                start = now.replace(
                    hour=max(9, min(18, now.hour + offset_hours)),
                    minute=0,
                    second=0,
                    microsecond=0,
                )
                end = start + service.duration
                status = (
                    Appointment.Status.IN_PROGRESS
                    if offset_hours == -2
                    else Appointment.Status.CONFIRMED
                )

                appt = self._create_appointment_if_possible(
                    client=client,
                    emp=emp,
                    service=service,
                    start=start,
                    end=end,
                    status=status,
                    booking_channel="online",
                    internal_notes="Demo – wizyta tego samego dnia.",
                    client_notes="",
                )
                appointments_with_none.append(appt)

            # Przyszłe wizyty (kolejne 2 tygodnie)
            future_days = [1, 2, 5, 7, 10, 14]
            for days_ahead in tqdm(future_days, desc="Tworzenie przyszłych wizyt"):
                client = random.choice(clients)
                emp = random.choice(employees)
                service = random.choice(services)
                start = (now + timedelta(days=days_ahead)).replace(
                    hour=random.choice([9, 11, 13, 15, 17]),
                    minute=0,
                    second=0,
                    microsecond=0,
                )
                end = start + service.duration
                status = random.choice(
                    [
                        Appointment.Status.PENDING,
                        Appointment.Status.CONFIRMED,
                    ]
                )

                appt = self._create_appointment_if_possible(
                    client=client,
                    emp=emp,
                    service=service,
                    start=start,
                    end=end,
                    status=status,
                    booking_channel="online",
                    internal_notes="Przyszła wizyta (seed_database).",
                    client_notes="Proszę o delikatny efekt.",
                )
                appointments_with_none.append(appt)

        # Linia 517: Poprawka no-redef i filtrowanie None.
        # Definiujemy appointments jako przefiltrowaną listę, używaną dalej w sekcjach 10-17.
        appointments: List[Appointment] = [a for a in appointments_with_none if a is not None]

        # PRZEGLĄD WSZYSTKICH WIZYT (na potrzeby statusów, notatek, itp.)
        for appt in appointments:
            if appt.status == Appointment.Status.CANCELLED:
                # Wcześniej te bloki były w pętlach tworzących, co powodowało problem,
                # bo appt było Optional[Appointment]. Teraz są tu, gdzie appt jest Appt.
                if appt.cancelled_by is None:
                    # Poprawka 511: Musimy sprawdzić, czy klient jest (zgodnie z mypy)
                    if appt.client is not None:
                        appt.cancelled_by = random.choice([appt.client.user, manager])
                        appt.cancelled_at = appt.start - timedelta(hours=random.randint(2, 26))
                        appt.cancellation_reason = random.choice(
                            ["Nagła choroba", "Kolizja terminów", "Inny powód prywatny"]
                        )
                        appt.save()
                    else:
                        logger.warning("Wizyta #%s ma status CANCELLED, ale brak przypisanego klienta. Pominięto ustawianie cancelled_by.", appt.id)


            if appt.status == Appointment.Status.NO_SHOW:
                appt.cancellation_reason = "Klient nie pojawił/a się na wizycie."
                appt.save()

        self.stdout.write(self.style.SUCCESS(f"✓ Utworzono {len(appointments)} wizyt."))

        # =========================================================================
        # 10. NOTES
        # =========================================================================
        notes = []
        if appointments:
            for appt in appointments[:10]:
                note = Note.objects.create(
                    appointment=appt,
                    client=appt.client,
                    author=random.choice([appt.employee.user, manager]),
                    content="Notatka wewnętrzna: klientka lubi spokojne kolory, unikać zbyt mocnych zmian.",
                    visible_for_client=random.choice([False, False, True]),
                )
                notes.append(note)

        self.stdout.write(self.style.SUCCESS(f"✓ Dodano {len(notes)} notatek do wizyt."))

        # =========================================================================
        # 11. PAYMENTS & INVOICES
        # =========================================================================
        payments = []
        invoices = []

        if appointments:
            for appt in appointments:  # appt jest teraz Appointment (nie None)
                if appt.status == Appointment.Status.COMPLETED:
                    base_amount = appt.service.price

                    # unikamy duplikatów płatności pełnych
                    if not Payment.objects.filter(
                            appointment=appt,
                            type=Payment.Type.FULL,
                    ).exists():
                        try:
                            payment = Payment.objects.create(
                                appointment=appt,
                                amount=base_amount,
                                status=Payment.Status.PAID,
                                method=random.choice(
                                    [
                                        Payment.Method.CARD,
                                        Payment.Method.CASH,
                                        Payment.Method.TRANSFER,
                                    ]
                                ),
                                type=Payment.Type.FULL,
                                paid_at=appt.end + timedelta(minutes=5),
                                reference=f"PAY-{appt.id:05d}",
                            )
                            payments.append(payment)
                        except Exception as e:
                            logger.error(
                                "Błąd tworzenia płatności FULL dla wizyty %s: %s",
                                appt.id,
                                e,
                            )

                    # Napiwek – też zabezpieczamy przed duplikatami
                    if random.random() < 0.4 and not Payment.objects.filter(
                            appointment=appt,
                            type=Payment.Type.TIP,
                            amount=Decimal("20.00"),
                    ).exists():
                        try:
                            full_payment = Payment.objects.filter(
                                appointment=appt,
                                type=Payment.Type.FULL,
                            ).first()

                            method_for_tip = Payment.Method.CARD

                            if full_payment:
                                # Poprawka 597: Dodanie type: ignore
                                method_for_tip = full_payment.method  # type: ignore[assignment]

                            tip = Payment.objects.create(
                                appointment=appt,
                                amount=Decimal("20.00"),
                                status=Payment.Status.PAID,
                                method=method_for_tip,
                                type=Payment.Type.TIP,
                                paid_at=appt.end + timedelta(minutes=5),
                                reference=f"TIP-{appt.id:05d}",
                            )
                            payments.append(tip)
                        except Exception as e:
                            logger.error(
                                "Błąd tworzenia napiwku dla wizyty %s: %s",
                                appt.id,
                                e,
                            )

                    # Faktura – tworzymy tylko jeśli jeszcze nie istnieje
                    if not Invoice.objects.filter(appointment=appt).exists():
                        vat_rate = settings_obj.default_vat_rate
                        vat_amount, gross_amount = calculate_vat(base_amount, vat_rate)
                        try:
                            invoice = Invoice.objects.create(
                                appointment=appt,
                                client=appt.client,  # OK
                                client_name=(
                                    appt.client.get_full_name()
                                    if appt.client  # OK
                                    else "Klient indywidualny"
                                ),
                                client_tax_id="",
                                net_amount=base_amount,
                                vat_rate=vat_rate,
                                vat_amount=vat_amount,
                                gross_amount=gross_amount,
                                issue_date=appt.end.date(),  # OK
                                sale_date=appt.start.date(),  # OK
                                due_date=appt.end.date() + timedelta(days=14),  # OK
                                paid_date=appt.end.date(),  # OK
                                status=Invoice.Status.PAID,
                                is_paid=True,
                            )
                            invoices.append(invoice)
                        except Exception as e:
                            logger.error(
                                "Błąd tworzenia faktury dla wizyty %s: %s",
                                appt.id,
                                e,
                            )

                elif appt.status in [Appointment.Status.PENDING, Appointment.Status.CONFIRMED]:
                    deposit_amount = (appt.service.price * Decimal("0.30")).quantize(Decimal("0.01"))

                    if not Payment.objects.filter(
                            appointment=appt,
                            type=Payment.Type.DEPOSIT,
                    ).exists():
                        try:
                            payment = Payment.objects.create(
                                appointment=appt,
                                amount=deposit_amount,
                                status=Payment.Status.DEPOSIT,
                                method=Payment.Method.TRANSFER,
                                type=Payment.Type.DEPOSIT,
                                paid_at=appt.start - timedelta(days=1),
                                reference=f"DEP-{appt.id:05d}",
                            )
                            payments.append(payment)
                        except Exception as e:
                            logger.error(
                                "Błąd tworzenia płatności DEPOSIT dla wizyty %s: %s",
                                appt.id,
                                e,
                            )

                elif appt.status == Appointment.Status.NO_SHOW:
                    deposit_amount = (appt.service.price * Decimal("0.30")).quantize(Decimal("0.01"))

                    if not Payment.objects.filter(
                            appointment=appt,
                            type=Payment.Type.DEPOSIT,
                            status=Payment.Status.FORFEITED,
                    ).exists():
                        try:
                            payment = Payment.objects.create(
                                appointment=appt,
                                amount=deposit_amount,
                                status=Payment.Status.FORFEITED,
                                method=Payment.Method.CARD,
                                type=Payment.Type.DEPOSIT,
                                paid_at=appt.start + timedelta(hours=1),
                                reference=f"FORF-{appt.id:05d}",
                            )
                            payments.append(payment)
                        except Exception as e:
                            logger.error(
                                "Błąd tworzenia płatności FORFEITED dla wizyty %s: %s",
                                appt.id,
                                e,
                            )

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Utworzono/uzupełniono {len(payments)} płatności oraz {len(invoices)} faktur."
            )
        )

        # =========================================================================
        # 12. UPDATE METRICS
        # =========================================================================
        for client in clients:
            completed_qs = Appointment.objects.filter(
                client=client,
                status=Appointment.Status.COMPLETED,
            )
            client.visits_count = completed_qs.count()
            client.total_spent_amount = (
                    Payment.objects.filter(
                        appointment__client=client,
                        status__in=[
                            Payment.Status.PAID,
                            Payment.Status.DEPOSIT,
                            Payment.Status.FORFEITED,
                        ],
                    ).aggregate(total=Sum("amount"))["total"]
                    or Decimal("0.00")
            )
            client.save()

        for emp in employees:
            completed_qs = Appointment.objects.filter(
                employee=emp,
                status=Appointment.Status.COMPLETED,
            )
            emp.appointments_count = completed_qs.count()
            emp.average_rating = (
                Decimal(str(random.choice([4.3, 4.5, 4.7, 4.9])))
                if completed_qs.exists()
                else Decimal("0.00")
            )
            emp.save()

        for service in services:
            service.reservations_count = Appointment.objects.filter(service=service).count()
            service.save(update_fields=["reservations_count"])

        self.stdout.write(self.style.SUCCESS("✓ Zaktualizowano metryki (klienci/pracownicy/usługi)."))

        # =========================================================================
        # 13. NOTIFICATIONS
        # =========================================================================
        notifications = []

        # List comprehensions są bezpieczne, bo appointments jest List[Appointment]
        upcoming_appointments: List[Appointment] = [
            a
            for a in appointments
            if a.start > now
               and a.status in [Appointment.Status.PENDING, Appointment.Status.CONFIRMED]
        ]
        for appt in upcoming_appointments[:5]:
            if appt.client is not None:
                notif = Notification.objects.create(
                    client=appt.client,
                    appointment=appt,
                    type=Notification.Type.REMINDER,
                    channel=random.choice(
                        [Notification.Channel.EMAIL, Notification.Channel.SMS]
                    ),
                    status=Notification.Status.PENDING,
                    subject="Przypomnienie o wizycie w Beauty Studio",
                    content=(
                        f"Cześć {appt.client.first_name}, przypominamy o Twojej wizycie "
                        f"{appt.start.strftime('%Y-%m-%d %H:%M')} na usługę {appt.service.name}."
                    ),
                    scheduled_at=appt.start - timedelta(hours=24),
                )
                notifications.append(notif)
            else:
                logger.warning(
                    "Pominięto powiadomienie dla wizyty %s, ponieważ klient jest None.",
                    appt.id,
                )

        cancelled_appointments: List[Appointment] = [
            a
            for a in appointments if a.status == Appointment.Status.CANCELLED
        ]
        if cancelled_appointments:
            appt = cancelled_appointments[0]
            if appt.client is not None:
                notif = Notification.objects.create(
                    client=appt.client,
                    appointment=appt,
                    type=Notification.Type.CANCELLATION,
                    channel=Notification.Channel.EMAIL,
                    status=Notification.Status.SENT,
                    subject="Potwierdzenie anulowania wizyty",
                    content=(
                        f"Twoja wizyta z dnia {appt.start.strftime('%Y-%m-%d %H:%M')} "
                        f"na usługę {appt.service.name} została anulowana.\n"
                        f"Powód: {appt.cancellation_reason or 'brak podanego powodu'}."
                    ),
                    scheduled_at=now - timedelta(hours=1),
                    sent_at=now - timedelta(minutes=30),
                )
                notifications.append(notif)
            else:
                logger.warning(
                    "Pominięto powiadomienie o anulowaniu dla wizyty %s, ponieważ klient jest None.",
                    appt.id,
                )

        if clients:
            for client in clients[:3]:
                notif = Notification.objects.create(
                    client=client,
                    appointment=None,
                    type=Notification.Type.PROMOTION,
                    channel=Notification.Channel.EMAIL,
                    status=Notification.Status.SENT,
                    subject="-20% na masaż relaksacyjny w tym tygodniu",
                    content=(
                        "Dla wybranych klientek przygotowaliśmy -20% na masaż "
                        "relaksacyjny pleców do końca tygodnia."
                    ),
                    scheduled_at=now - timedelta(days=1),
                    sent_at=now - timedelta(hours=12),
                )
                notifications.append(notif)

        self.stdout.write(self.style.SUCCESS(f"✓ Dodano {len(notifications)} powiadomień."))

        # =========================================================================
        # 14. MEDIA ASSETS
        # =========================================================================
        media_assets = []
        for emp in employees:
            for idx_type, type_choice in enumerate(
                    [MediaAsset.Type.BEFORE, MediaAsset.Type.AFTER, MediaAsset.Type.OTHER]
            ):
                dummy_content = ContentFile(
                    b"PSEUDO-BINARY-DATA",
                    name=f"portfolio_{emp.user_id}_{idx_type + 1}.jpg",
                )
                asset = MediaAsset.objects.create(
                    employee=emp,
                    name=f"Portfolio {emp.first_name} #{idx_type + 1}",
                    file=dummy_content,
                    file_name=f"portfolio_{emp.user_id}_{idx_type + 1}.jpg",
                    file_url=(
                        f"https://picsum.photos/seed/emp_{emp.user_id}_{idx_type + 1}/800/600"
                    ),
                    mime_type="image/jpeg",
                    type=type_choice,
                    description="Przykładowe zdjęcie przed/po – dane testowe.",
                    is_active=True,
                    is_private=False,
                )
                media_assets.append(asset)

        self.stdout.write(
            self.style.SUCCESS(f"✓ Utworzono {len(media_assets)} zasobów multimedialnych.")
        )

        # =========================================================================
        # 15. STATS SNAPSHOTS
        # =========================================================================
        period_end = now.date()
        period_start_30 = period_end - timedelta(days=30)
        period_start_7 = period_end - timedelta(days=7)

        revenue_total_30 = (
                Payment.objects.filter(
                    paid_at__date__gte=period_start_30,
                    paid_at__date__lte=period_end,
                    status__in=[
                        Payment.Status.PAID,
                        Payment.Status.DEPOSIT,
                        Payment.Status.FORFEITED,
                    ],
                ).aggregate(total=Sum("amount"))["total"]
                or Decimal("0.00")
        )

        revenue_deposits_30 = (
                Payment.objects.filter(
                    paid_at__date__gte=period_start_30,
                    paid_at__date__lte=period_end,
                    status__in=[Payment.Status.DEPOSIT, Payment.Status.FORFEITED],
                ).aggregate(total=Sum("amount"))["total"]
                or Decimal("0.00")
        )

        snapshot_monthly = StatsSnapshot.objects.create(
            period=StatsSnapshot.Period.MONTHLY,
            date_from=period_start_30,
            date_to=period_end,
            total_visits=Appointment.objects.filter(
                start__date__gte=period_start_30,
                start__date__lte=period_end,
            ).count(),
            completed_visits=Appointment.objects.filter(
                status=Appointment.Status.COMPLETED,
                start__date__gte=period_start_30,
                start__date__lte=period_end,
            ).count(),
            cancellations=Appointment.objects.filter(
                status=Appointment.Status.CANCELLED,
                start__date__gte=period_start_30,
                start__date__lte=period_end,
            ).count(),
            no_shows=Appointment.objects.filter(
                status=Appointment.Status.NO_SHOW,
                start__date__gte=period_start_30,
                start__date__lte=period_end,
            ).count(),
            revenue_total=revenue_total_30,
            revenue_deposits=revenue_deposits_30,
            new_clients=len(clients),
            returning_clients=max(0, len(clients) - 3),
            employees_occupancy_avg=Decimal("65.00"),
            extra_metrics={
                "source": "seed_database",
                "note": "Dane przykładowe – snapshot miesięczny",
            },
        )

        revenue_total_7 = (
                Payment.objects.filter(
                    paid_at__date__gte=period_start_7,
                    paid_at__date__lte=period_end,
                    status__in=[
                        Payment.Status.PAID,
                        Payment.Status.DEPOSIT,
                        Payment.Status.FORFEITED,
                    ],
                ).aggregate(total=Sum("amount"))["total"]
                or Decimal("0.00")
        )

        revenue_deposits_7 = (
                Payment.objects.filter(
                    paid_at__date__gte=period_start_7,
                    paid_at__date__lte=period_end,
                    status__in=[Payment.Status.DEPOSIT, Payment.Status.FORFEITED],
                ).aggregate(total=Sum("amount"))["total"]
                or Decimal("0.00")
        )

        snapshot_weekly = StatsSnapshot.objects.create(
            period=StatsSnapshot.Period.WEEKLY,
            date_from=period_start_7,
            date_to=period_end,
            total_visits=Appointment.objects.filter(
                start__date__gte=period_start_7,
                start__date__lte=period_end,
            ).count(),
            completed_visits=Appointment.objects.filter(
                status=Appointment.Status.COMPLETED,
                start__date__gte=period_start_7,
                start__date__lte=period_end,
            ).count(),
            cancellations=Appointment.objects.filter(
                status=Appointment.Status.CANCELLED,
                start__date__gte=period_start_7,
                start__date__lte=period_end,
            ).count(),
            no_shows=Appointment.objects.filter(
                status=Appointment.Status.NO_SHOW,
                start__date__gte=period_start_7,
                start__date__lte=period_end,
            ).count(),
            revenue_total=revenue_total_7,
            revenue_deposits=revenue_deposits_7,
            new_clients=len(clients),
            returning_clients=max(0, len(clients) - 5),
            employees_occupancy_avg=Decimal("72.50"),
            extra_metrics={
                "source": "seed_database",
                "note": "Dane przykładowe – snapshot tygodniowy",
            },
        )

        self.stdout.write(self.style.SUCCESS("✓ Zapisano migawki statystyk (weekly + monthly)."))

        # =========================================================================
        # 16. REPORT PDF
        # =========================================================================
        # data_od/data_do są aliasami pól date_from/date_to w modelu, trzymamy je spójnie
        pdf_bytes = b"%PDF-1.4\n%Fake PDF content for demo\n"
        pdf_content = ContentFile(pdf_bytes, name="raport_miesieczny_demo.pdf")
        ReportPDF.objects.create(
            type=ReportPDF.Type.FINANCIAL,
            title="Raport miesięczny – dane demo",
            date_from=period_start_30,
            date_to=period_end,
            data_od=period_start_30,
            data_do=period_end,
            generated_by=manager,
            file=pdf_content,
            file_path="reports/raport_miesieczny_demo.pdf",
            file_size=len(pdf_bytes),
            parameters={
                "period": "last_30_days",
                "include_tips": True,
                "generated_from_seed": True,
            },
            notes="Raport wygenerowany jako część seeda bazy danych.",
        )

        self.stdout.write(
            self.style.SUCCESS("✓ Utworzono przykładowy raport PDF (mock pliku).")
        )

        # =========================================================================
        # 17. AUDIT LOGS
        # =========================================================================
        audit_logs = []

        audit_logs.append(
            AuditLog.objects.create(
                type=AuditLog.Type.SYSTEM_OPERATION,
                level=AuditLog.Level.INFO,
                user=manager,
                message=(
                    "Inicjalne zasilenie bazy danymi demo "
                    "(seed_database – wersja rozszerzona)."
                ),
                adres_ip="127.0.0.1",
                user_agent="seed-script/1.0",
                entity_type="seed",
                entity_id="initial",
                metadata={
                    "snapshot_monthly_id": snapshot_monthly.id,
                    "snapshot_weekly_id": snapshot_weekly.id,
                },
            )
        )

        if appointments:
            example_appt = appointments[0]  # OK, bo lista jest już przefiltrowana
            audit_logs.append(
                AuditLog.objects.create(
                    type=AuditLog.Type.APPOINTMENT_CHANGE,
                    level=AuditLog.Level.INFO,
                    user=example_appt.employee.user,
                    message=f"Utworzono wizytę demo #{example_appt.id}.",
                    adres_ip="127.0.0.1",
                    user_agent="seed-script/1.0",
                    entity_type="appointment",
                    entity_id=str(example_appt.id),
                    metadata={
                        "status": example_appt.status,
                        "service": example_appt.service.name,
                    },
                )
            )

        forfeited_payment = Payment.objects.filter(
            status=Payment.Status.FORFEITED
        ).first()
        if forfeited_payment:
            audit_logs.append(
                AuditLog.objects.create(
                    type=AuditLog.Type.PAYMENT_DEPOSIT_FORFEITED,
                    level=AuditLog.Level.WARNING,
                    user=manager,
                    message=f"Utracona zaliczka demo #{forfeited_payment.id}.",
                    adres_ip="127.0.0.1",
                    user_agent="seed-script/1.0",
                    entity_type="payment",
                    entity_id=str(forfeited_payment.id),
                    metadata={"amount": str(forfeited_payment.amount)},
                )
            )

        self.stdout.write(
            self.style.SUCCESS(f"✓ Dodano {len(audit_logs)} wpisów do logu audytu.")
        )

        # =========================================================================
        # 18. SUMMARY
        # =========================================================================
        self.stdout.write("")
        self.stdout.write("-" * 72)
        self.stdout.write(self.style.SUCCESS("Zasilanie bazy danymi demo – ZAKOŃCZONE."))
        self.stdout.write("")
        self.stdout.write("Logowanie jako manager:")
        self.stdout.write("  • e-mail: manager@inzynierski-salon.demo")
        self.stdout.write("  • hasło : admin123 (TYLKO DEMO!)")
        self.stdout.write("-" * 72)

    # =====================================================================
    # HELPERY – WIZYTY (kolizje + bezpieczne tworzenie)
    # =====================================================================
    # Poprawka: Zmieniono timezone.datetime na samo datetime
    def _is_slot_free(self, employee: Employee, start: datetime, end: datetime) -> bool:
        """
        Sprawdza, czy pracownik ma wolny slot w danym przedziale czasu.
        Prosta walidacja kolizji wizyt (brak nakładania się przedziałów).
        """
        return not Appointment.objects.filter(
            employee=employee,
            start__lt=end,
            end__gt=start,
        ).exists()

    def _create_appointment_if_possible(
            self,
            *,
            client: Client,
            emp: Employee,
            service: Service,
            # Poprawka: Zmieniono timezone.datetime na samo datetime
            start: datetime,
            end: datetime,
            status: str,
            booking_channel: str,
            internal_notes: str,
            client_notes: str,
    ) -> Optional[Appointment]:
        """
        Tworzy wizytę tylko jeśli nie ma kolizji czasowych.
        W razie błędu loguje go i zwraca None (zamiast przerywać cały seed).
        """
        if not self._is_slot_free(emp, start, end):
            logger.warning(
                "Pominięto wizytę z powodu kolizji czasu (pracownik=%s, start=%s, end=%s)",
                emp.pk,
                start,
                end,
            )
            return None

        try:
            appt = Appointment.objects.create(
                client=client,
                employee=emp,
                service=service,
                start=start,
                end=end,
                status=status,
                booking_channel=booking_channel,
                internal_notes=internal_notes,
                client_notes=client_notes,
            )
            return appt
        except Exception as e:
            logger.error(
                "Błąd tworzenia wizyty demo (pracownik=%s, klient=%s, start=%s): %s",
                emp.pk,
                client.id if client else None,
                start,
                e,
            )
            return None

    # =====================================================================
    # HELPER: CLEAR DEMO DATA
    # =====================================================================
    def clear_demo_data(self) -> None:
        """Czyści dane demo z głównych modeli (w sensownej kolejności)."""
        self.stdout.write(self.style.WARNING("Usuwam istniejące dane demo..."))

        models_in_order: List[ModelBase] = [
            Note,
            Notification,
            MediaAsset,
            Payment,
            Invoice,
            Appointment,
            TimeOff,
            Schedule,
            StatsSnapshot,
            ReportPDF,
            AuditLog,
            Service,
            Client,
            Employee,
        ]

        for model in models_in_order:
            # Wymagane użycie type: ignore, ponieważ ModelBase (z Base) nie ma w pełni
            # określonego menadżera .objects (który ma model Django)
            deleted = model.objects.all().delete()[0]  # type: ignore[attr-defined]
            self.stdout.write(f"  - Usunięto {deleted:4d} rekordów z {model.__name__}")

        # Usuń użytkowników z ról systemowych (manager/employee/client)
        user_deleted = User.objects.filter(
            role__in=[
                User.RoleChoices.MANAGER,
                User.RoleChoices.EMPLOYEE,
                User.RoleChoices.CLIENT,
            ]
        ).delete()[0]
        self.stdout.write(
            f"  - Usunięto {user_deleted:4d} użytkowników (role: manager/employee/client)"
        )

        self.stdout.write(self.style.SUCCESS("✓ Dane demo usunięte."))