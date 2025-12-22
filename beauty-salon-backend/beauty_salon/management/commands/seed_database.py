"""
Komenda Django do wypełnienia bazy danych przykładowymi danymi (seed data).
Beauty Salon Management System

Uruchomienie:
    py manage.py seed_database
    py manage.py seed_database --clear
"""

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from beauty_salon.models import (
    CustomUser,
    Service,
    EmployeeProfile,
    ClientProfile,
    EmployeeSchedule,
    TimeOff,
    Appointment,
    SystemSettings,
)


def run_seed(clear_existing_data: bool = False) -> None:
    print("Rozpoczynam inicjalizację bazy danych...")
    print("-" * 60)

    # =============================================================================
    # KONFIGURACJA
    # =============================================================================
    if clear_existing_data:
        print("Usuwam istniejące dane...")
        Appointment.objects.all().delete()
        TimeOff.objects.all().delete()
        EmployeeSchedule.objects.all().delete()
        ClientProfile.objects.all().delete()
        EmployeeProfile.objects.all().delete()
        Service.objects.all().delete()
        CustomUser.objects.filter(is_superuser=False).delete()
        print("Dane usunięte.")
        print("-" * 60)

    # =============================================================================
    # 1. USTAWIENIA SYSTEMU
    # =============================================================================

    print("Krok 1/9: Tworzenie ustawień systemu...")

    settings_obj, created = SystemSettings.objects.get_or_create(
        pk=1,
        defaults={
            "salon_name": "Beauty Salon",
            "slot_minutes": 15,
            "buffer_minutes": 10,
            "opening_hours": {
                "mon": [{"start": "09:00", "end": "18:00"}],
                "tue": [{"start": "09:00", "end": "18:00"}],
                "wed": [{"start": "09:00", "end": "18:00"}],
                "thu": [{"start": "09:00", "end": "18:00"}],
                "fri": [{"start": "09:00", "end": "18:00"}],
                "sat": [{"start": "10:00", "end": "16:00"}],
                "sun": [],
            },
        },
    )

    if created:
        print("  Utworzono: SystemSettings (ID: 1)")
    else:
        print("  Istnieje: SystemSettings (ID: 1)")

    # =============================================================================
    # 2. UŻYTKOWNICY - ADMINISTRATOR
    # =============================================================================

    print("\nKrok 2/9: Tworzenie użytkowników - Administrator...")

    admin, created = CustomUser.objects.get_or_create(
        username="admin",
        defaults={
            "first_name": "Administrator",
            "last_name": "Systemu",
            "email": "admin@beautysalon.pl",
            "role": "ADMIN",
            "is_staff": True,
            "is_superuser": True,
        },
    )

    if created:
        admin.set_password("admin123")
        admin.save()
        print("  Utworzono: admin (hasło: admin123)")
    else:
        print("  Istnieje: admin")

    # =============================================================================
    # 3. UŻYTKOWNICY - PRACOWNICY
    # =============================================================================

    print("\nKrok 3/9: Tworzenie użytkowników - Pracownicy...")

    employees_data = [
        {
            "username": "anna.kowalska",
            "first_name": "Anna",
            "last_name": "Kowalska",
            "email": "anna.kowalska@beautysalon.pl",
            "phone": "+48501234567",
        },
        {
            "username": "maria.nowak",
            "first_name": "Maria",
            "last_name": "Nowak",
            "email": "maria.nowak@beautysalon.pl",
            "phone": "+48502345678",
        },
        {
            "username": "zofia.wisniewski",
            "first_name": "Zofia",
            "last_name": "Wisniewski",
            "email": "zofia.wisniewski@beautysalon.pl",
            "phone": "+48503456789",
        },
    ]

    employee_users = []
    for emp_data in employees_data:
        user, created = CustomUser.objects.get_or_create(
            username=emp_data["username"],
            defaults={
                "first_name": emp_data["first_name"],
                "last_name": emp_data["last_name"],
                "email": emp_data["email"],
                "role": "EMPLOYEE",
            },
        )

        if created:
            user.set_password("employee123")
            user.save()
            print(f"  Utworzono: {emp_data['username']} (hasło: employee123)")
        else:
            print(f"  Istnieje: {emp_data['username']}")

        employee_users.append(user)

    # =============================================================================
    # 4. UŻYTKOWNICY - KLIENCI
    # =============================================================================

    print("\nKrok 4/9: Tworzenie użytkowników - Klienci...")

    clients_data = [
        {
            "username": "klient1",
            "first_name": "Katarzyna",
            "last_name": "Zielinska",
            "email": "katarzyna.zielinska@gmail.com",
            "phone": "+48601234567",
        },
        {
            "username": "klient2",
            "first_name": "Magdalena",
            "last_name": "Lewandowska",
            "email": "magdalena.lewandowska@gmail.com",
            "phone": "+48602345678",
        },
        {
            "username": "klient3",
            "first_name": "Agnieszka",
            "last_name": "Kaminska",
            "email": "agnieszka.kaminska@gmail.com",
            "phone": "+48603456789",
        },
    ]

    client_users = []
    for client_data in clients_data:
        user, created = CustomUser.objects.get_or_create(
            username=client_data["username"],
            defaults={
                "first_name": client_data["first_name"],
                "last_name": client_data["last_name"],
                "email": client_data["email"],
                "role": "CLIENT",
            },
        )

        if created:
            user.set_password("client123")
            user.save()
            print(f"  Utworzono: {client_data['username']} (hasło: client123)")
        else:
            print(f"  Istnieje: {client_data['username']}")

        client_users.append(user)

    # =============================================================================
    # 5. USŁUGI
    # =============================================================================

    print("\nKrok 5/9: Tworzenie usług...")

    services_data = [
        # Paznokcie
        {"name": "Manicure klasyczny", "category": "Paznokcie", "price": 50, "duration": 45,
         "desc": "Podstawowy manicure z malowaniem"},
        {"name": "Manicure hybrydowy", "category": "Paznokcie", "price": 80, "duration": 60,
         "desc": "Manicure z użyciem lakieru hybrydowego"},
        {"name": "Manicure żelowy", "category": "Paznokcie", "price": 100, "duration": 90,
         "desc": "Przedłużanie paznokci metodą żelową"},
        {"name": "Pedicure klasyczny", "category": "Paznokcie", "price": 60, "duration": 60,
         "desc": "Podstawowy pedicure z malowaniem"},
        {"name": "Pedicure hybrydowy", "category": "Paznokcie", "price": 90, "duration": 75,
         "desc": "Pedicure z lakierem hybrydowym"},

        # Rzęsy
        {"name": "Przedłużanie rzęs 1:1", "category": "Rzęsy", "price": 120, "duration": 90,
         "desc": "Klasyczne przedłużanie metodą 1:1"},
        {"name": "Przedłużanie rzęs 2D-3D", "category": "Rzęsy", "price": 150, "duration": 120,
         "desc": "Przedłużanie metodą objętościową"},
        {"name": "Lifting rzęs", "category": "Rzęsy", "price": 100, "duration": 60,
         "desc": "Laminacja i lifting naturalnych rzęs"},
        {"name": "Uzupełnienie rzęs", "category": "Rzęsy", "price": 80, "duration": 60,
         "desc": "Uzupełnienie po 2-3 tygodniach"},

        # Brwi
        {"name": "Stylizacja brwi", "category": "Brwi", "price": 40, "duration": 30,
         "desc": "Regulacja kształtu brwi"},
        {"name": "Henna brwi", "category": "Brwi", "price": 50, "duration": 45,
         "desc": "Farbowanie henną"},
        {"name": "Microblading", "category": "Brwi", "price": 400, "duration": 120,
         "desc": "Makijaż permanentny brwi"},

        # Twarz
        {"name": "Oczyszczanie wodorowe", "category": "Twarz", "price": 120, "duration": 60,
         "desc": "Głębokie oczyszczanie twarzy"},
        {"name": "Mezoterapia igłowa", "category": "Twarz", "price": 200, "duration": 45,
         "desc": "Zabieg mezoterapii"},
        {"name": "Peeling kawitacyjny", "category": "Twarz", "price": 100, "duration": 45,
         "desc": "Peeling ultradźwiękowy"},
        {"name": "Masaż twarzy", "category": "Twarz", "price": 80, "duration": 45,
         "desc": "Relaksujący masaż twarzy"},

        # Depilacja i masaż
        {"name": "Depilacja woskiem - nogi", "category": "Depilacja", "price": 80, "duration": 45,
         "desc": "Depilacja całych nóg"},
        {"name": "Depilacja woskiem - pachy", "category": "Depilacja", "price": 40, "duration": 20,
         "desc": "Depilacja pach"},
        {"name": "Depilacja laserowa - nogi", "category": "Depilacja", "price": 300, "duration": 60,
         "desc": "Laserowe usuwanie owłosienia"},
        {"name": "Masaż relaksacyjny", "category": "Masaż", "price": 150, "duration": 60,
         "desc": "Masaż całego ciała"},
    ]

    services = []
    service_count = 0
    for svc_data in services_data:
        service, created = Service.objects.get_or_create(
            name=svc_data["name"],
            defaults={
                "category": svc_data["category"],
                "description": svc_data["desc"],
                "price": Decimal(svc_data["price"]),
                "duration_minutes": svc_data["duration"],
                "is_active": True,
            },
        )
        services.append(service)
        if created:
            service_count += 1

    print(f"  Utworzono: {service_count} nowych usług (razem: {Service.objects.count()})")

    # =============================================================================
    # 6. PROFILE PRACOWNIKÓW
    # =============================================================================

    print("\nKrok 6/9: Tworzenie profili pracowników...")

    employees = []
    employee_count = 0

    for i, (user, emp_data) in enumerate(zip(employee_users, employees_data)):
        profile, created = EmployeeProfile.objects.get_or_create(
            user=user,
            defaults={
                "first_name": emp_data["first_name"],
                "last_name": emp_data["last_name"],
                "phone": emp_data["phone"],
                "is_active": True,
                "hired_at": timezone.now().date() - timedelta(days=365),
            },
        )

        # Przypisanie umiejętności (specjalizacja)
        if i == 0:  # Anna - paznokcie
            profile.skills.set(services[:5])
        elif i == 1:  # Maria - rzęsy i brwi
            profile.skills.set(services[5:12])
        else:  # Zofia - twarz i ciało
            profile.skills.set(services[12:])

        employees.append(profile)
        if created:
            employee_count += 1
            print(f"  Utworzono: {profile.get_full_name()} (Nr: {profile.employee_number})")
        else:
            print(f"  Istnieje: {profile.get_full_name()} (Nr: {profile.employee_number})")

    # =============================================================================
    # 7. GRAFIKI PRACOWNIKÓW
    # =============================================================================

    print("\nKrok 7/9: Tworzenie grafików pracy...")

    standard_schedule = {
        "mon": [{"start": "09:00", "end": "17:00"}],
        "tue": [{"start": "09:00", "end": "17:00"}],
        "wed": [{"start": "09:00", "end": "17:00"}],
        "thu": [{"start": "09:00", "end": "17:00"}],
        "fri": [{"start": "09:00", "end": "17:00"}],
        "sat": [{"start": "10:00", "end": "15:00"}],
        "sun": [],
    }

    schedule_count = 0
    for employee in employees:
        schedule, created = EmployeeSchedule.objects.get_or_create(
            employee=employee,
            defaults={"weekly_hours": standard_schedule},
        )
        if created:
            schedule_count += 1

    print(f"  Utworzono: {schedule_count} nowych grafików (razem: {EmployeeSchedule.objects.count()})")

    # =============================================================================
    # 8. PROFILE KLIENTÓW
    # =============================================================================

    print("\nKrok 8/9: Tworzenie profili klientów...")

    clients = []
    client_count = 0

    # Klienci z kontem użytkownika
    for user, client_data in zip(client_users, clients_data):
        profile, created = ClientProfile.objects.get_or_create(
            user=user,
            defaults={
                "first_name": client_data["first_name"],
                "last_name": client_data["last_name"],
                "email": client_data["email"],
                "phone": client_data["phone"],
                "is_active": True,
            },
        )
        clients.append(profile)
        if created:
            client_count += 1
            print(f"  Utworzono: {profile.get_full_name()} (Nr: {profile.client_number})")
        else:
            print(f"  Istnieje: {profile.get_full_name()} (Nr: {profile.client_number})")

    # Klienci bez konta (dodani przez personel)
    extra_clients_data = [
        {"first_name": "Julia", "last_name": "Kowalczyk", "phone": "+48604567890",
         "email": "julia.k@gmail.com"},
        {"first_name": "Natalia", "last_name": "Wojcik", "phone": "+48605678901",
         "email": "natalia.w@gmail.com"},
    ]

    for client_data in extra_clients_data:
        profile, created = ClientProfile.objects.get_or_create(
            email=client_data["email"],
            defaults={
                "user": None,
                "first_name": client_data["first_name"],
                "last_name": client_data["last_name"],
                "phone": client_data["phone"],
                "is_active": True,
            },
        )
        clients.append(profile)
        if created:
            client_count += 1
            print(f"  Utworzono: {profile.get_full_name()} (Nr: {profile.client_number}, bez konta)")

    # =============================================================================
    # 9. WIZYTY (przykładowe dane testowe)
    # =============================================================================

    print("\nKrok 9/9: Tworzenie przykładowych wizyt...")

    appointment_count = 0

    # Wizyty zakończone (przeszłość)
    past_appointments = [
        {
            "client": clients[0],
            "employee": employees[0],
            "service": services[1],  # Manicure hybrydowy
            "days_ago": 7,
            "hour": 10,
            "status": "COMPLETED",
        },
        {
            "client": clients[1],
            "employee": employees[1],
            "service": services[5],  # Przedłużanie rzęs
            "days_ago": 5,
            "hour": 14,
            "status": "COMPLETED",
        },
        {
            "client": clients[2],
            "employee": employees[2],
            "service": services[12],  # Oczyszczanie wodorowe
            "days_ago": 3,
            "hour": 11,
            "status": "COMPLETED",
        },
    ]

    for appt_data in past_appointments:
        start = timezone.now() - timedelta(days=appt_data["days_ago"])
        start = start.replace(hour=appt_data["hour"], minute=0, second=0, microsecond=0)
        end = start + timedelta(minutes=int(appt_data["service"].duration_minutes) + 10)

        appointment, created = Appointment.objects.get_or_create(
            client=appt_data["client"],
            employee=appt_data["employee"],
            service=appt_data["service"],
            start=start,
            defaults={
                "end": end,
                "status": appt_data["status"],
            },
        )
        if created:
            appointment_count += 1

    # Wizyty przyszłe
    future_appointments = [
        {
            "client": clients[0],
            "employee": employees[0],
            "service": services[2],  # Manicure żelowy
            "days_ahead": 2,
            "hour": 10,
            "status": "CONFIRMED",
        },
        {
            "client": clients[1],
            "employee": employees[1],
            "service": services[7],  # Lifting rzęs
            "days_ahead": 3,
            "hour": 15,
            "status": "CONFIRMED",
        },
        {
            "client": clients[3],
            "employee": employees[2],
            "service": services[13],  # Mezoterapia
            "days_ahead": 5,
            "hour": 12,
            "status": "PENDING",
        },
        {
            "client": clients[4],
            "employee": employees[0],
            "service": services[4],  # Pedicure hybrydowy
            "days_ahead": 7,
            "hour": 14,
            "status": "PENDING",
        },
    ]

    for appt_data in future_appointments:
        start = timezone.now() + timedelta(days=appt_data["days_ahead"])
        start = start.replace(hour=appt_data["hour"], minute=0, second=0, microsecond=0)
        end = start + timedelta(minutes=int(appt_data["service"].duration_minutes) + 10)

        appointment, created = Appointment.objects.get_or_create(
            client=appt_data["client"],
            employee=appt_data["employee"],
            service=appt_data["service"],
            start=start,
            defaults={
                "end": end,
                "status": appt_data["status"],
            },
        )
        if created:
            appointment_count += 1

    # Wizyta anulowana
    cancelled_start = timezone.now() + timedelta(days=1)
    cancelled_start = cancelled_start.replace(hour=16, minute=0, second=0, microsecond=0)
    cancelled_end = cancelled_start + timedelta(minutes=int(services[0].duration_minutes) + 10)

    appointment, created = Appointment.objects.get_or_create(
        client=clients[2],
        employee=employees[0],
        service=services[0],
        start=cancelled_start,
        defaults={
            "end": cancelled_end,
            "status": "CANCELLED",
            "internal_notes": "Klient odwołał wizytę z powodów osobistych.",
        },
    )
    if created:
        appointment_count += 1

    print(f"  Utworzono: {appointment_count} nowych wizyt (razem: {Appointment.objects.count()})")

    # =============================================================================
    # 10. NIEOBECNOŚCI
    # =============================================================================

    print("\nKrok 10/10: Tworzenie nieobecności...")

    time_off_count = 0
    time_off, created = TimeOff.objects.get_or_create(
        employee=employees[1],
        date_from=(timezone.now() + timedelta(days=10)).date(),
        date_to=(timezone.now() + timedelta(days=17)).date(),
        defaults={
            "reason": "Urlop wypoczynkowy",
        },
    )
    if created:
        time_off_count += 1

    print(f"  Utworzono: {time_off_count} nowych nieobecności (razem: {TimeOff.objects.count()})")

    # =============================================================================
    # PODSUMOWANIE
    # =============================================================================

    print("\n" + "=" * 60)
    print("INICJALIZACJA BAZY DANYCH ZAKOŃCZONA")
    print("=" * 60)

    print("\nStatystyki bazy danych:")
    print(f"  Użytkownicy:              {CustomUser.objects.count()}")
    print(f"  Usługi:                   {Service.objects.count()}")
    print(f"  Profile pracowników:      {EmployeeProfile.objects.count()}")
    print(f"  Profile klientów:         {ClientProfile.objects.count()}")
    print(f"  Grafiki pracy:            {EmployeeSchedule.objects.count()}")
    print(f"  Wizyty:                   {Appointment.objects.count()}")
    print(f"  Nieobecności:             {TimeOff.objects.count()}")

    print("\nDane logowania:")
    print("  Administrator:  admin / admin123")
    print("  Pracownik:      anna.kowalska / employee123")
    print("  Klient:         klient1 / client123")

    print("\nNastępne kroki:")
    print("  1. python manage.py runserver")
    print("  2. Otwórz: http://localhost:8000/admin/")
    print("  3. Zaloguj się jako admin")

    print("\nGotowe.")
    print("=" * 60)


class Command(BaseCommand):
    help = "Inicjalizuje bazę danych danymi startowymi (seed)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Usuwa istniejące dane przed seedem (UWAGA: kasuje dane!)",
        )

    def handle(self, *args, **options):
        run_seed(clear_existing_data=options["clear"])
        self.stdout.write(self.style.SUCCESS("Seed zakończony."))
