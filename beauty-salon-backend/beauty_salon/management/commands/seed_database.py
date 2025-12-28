from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from beauty_salon.models import (
    Appointment,
    ClientProfile,
    CustomUser,
    EmployeeProfile,
    EmployeeSchedule,
    Service,
    SystemSettings,
    TimeOff,
)


def _dt(days_offset: int, hour: int, minute: int = 0):
    """Helper: timezone-aware datetime in local tz."""
    now = timezone.localtime(timezone.now())
    d = now + timedelta(days=days_offset)
    return d.replace(hour=hour, minute=minute, second=0, microsecond=0)


@transaction.atomic
def seed(clear: bool = False) -> None:
    # -------------------------------------------------------------------------
    # CLEAR
    # -------------------------------------------------------------------------
    if clear:
        Appointment.objects.all().delete()
        TimeOff.objects.all().delete()
        EmployeeSchedule.objects.all().delete()
        ClientProfile.objects.all().delete()
        EmployeeProfile.objects.all().delete()
        Service.objects.all().delete()

        # Usuń wszystkich userów poza superuserami (żeby nie skasować admina jeśli już jest)
        CustomUser.objects.filter(is_superuser=False).delete()

    # -------------------------------------------------------------------------
    # SYSTEM SETTINGS
    # -------------------------------------------------------------------------
    settings_obj, _ = SystemSettings.objects.get_or_create(
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
    buffer_minutes = int(settings_obj.buffer_minutes or 0)

    # -------------------------------------------------------------------------
    # ADMIN USER
    # -------------------------------------------------------------------------
    admin, created = CustomUser.objects.get_or_create(
        username="admin-00000001",
        defaults={
            "first_name": "Administrator",
            "last_name": "Systemu",
            "email": "admin@beautysalon.pl",
            "role": "ADMIN",
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
        },
    )
    if created:
        admin.set_password("admin123")
        admin.full_clean()
        admin.save()
    else:
        # Upewnij się, że admin ma poprawne flagi
        updated = False
        if not admin.is_staff:
            admin.is_staff = True
            updated = True
        if not admin.is_superuser:
            admin.is_superuser = True
            updated = True
        if admin.role != "ADMIN":
            admin.role = "ADMIN"
            updated = True
        if updated:
            admin.full_clean()
            admin.save()

    # -------------------------------------------------------------------------
    # EMPLOYEES
    # -------------------------------------------------------------------------
    employees_data = [
        {
            "username": "anna.kowalska",
            "first_name": "Anna",
            "last_name": "Kowalska",
            "email": "anna.kowalska@beautysalon.pl",
            "phone": "+48501234567",
            "employee_number": "00000001",
        },
        {
            "username": "maria.nowak",
            "first_name": "Maria",
            "last_name": "Nowak",
            "email": "maria.nowak@beautysalon.pl",
            "phone": "+48502345678",
            "employee_number": "00000002",
        },
        {
            "username": "zofia.wisniewska",
            "first_name": "Zofia",
            "last_name": "Wiśniewska",
            "email": "zofia.wisniewska@beautysalon.pl",
            "phone": "+48503456789",
            "employee_number": "00000003",
        },
    ]

    employee_profiles: list[EmployeeProfile] = []
    for e in employees_data:
        u, created = CustomUser.objects.get_or_create(
            username=e["username"],
            defaults={
                "first_name": e["first_name"],
                "last_name": e["last_name"],
                "email": e["email"],
                "role": "EMPLOYEE",
                "is_active": True,
                "is_staff": True,  # często pracownicy mają dostęp do panelu
            },
        )
        if created:
            u.set_password("employee123")
        else:
            # dopnij role/flagę jeśli ktoś wcześniej istniał
            u.role = "EMPLOYEE"
            u.is_active = True
            u.is_staff = True
            if u.email != e["email"]:
                u.email = e["email"]

        u.full_clean()
        u.save()

        profile, _ = EmployeeProfile.objects.get_or_create(
            user=u,
            defaults={
                "employee_number": e["employee_number"],
                "first_name": e["first_name"],
                "last_name": e["last_name"],
                "phone": e["phone"],
                "is_active": True,
            },
        )

        # Upewnij się, że numer pracownika jest ustawiony
        if not profile.employee_number:
            profile.employee_number = e["employee_number"]
            profile.save(update_fields=["employee_number"])

        employee_profiles.append(profile)

    # -------------------------------------------------------------------------
    # SERVICES
    # -------------------------------------------------------------------------
    services_data = [
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

        {"name": "Przedłużanie rzęs 1:1", "category": "Rzęsy", "price": 120, "duration": 90,
         "desc": "Klasyczne przedłużanie metodą 1:1"},
        {"name": "Przedłużanie rzęs 2D-3D", "category": "Rzęsy", "price": 150, "duration": 120,
         "desc": "Przedłużanie metodą objętościową"},
        {"name": "Lifting rzęs", "category": "Rzęsy", "price": 100, "duration": 60,
         "desc": "Laminacja i lifting naturalnych rzęs"},
        {"name": "Uzupełnienie rzęs", "category": "Rzęsy", "price": 80, "duration": 60,
         "desc": "Uzupełnienie po 2-3 tygodniach"},

        {"name": "Stylizacja brwi", "category": "Brwi", "price": 40, "duration": 30,
         "desc": "Regulacja kształtu brwi"},
        {"name": "Henna brwi", "category": "Brwi", "price": 50, "duration": 45,
         "desc": "Farbowanie henną"},
        {"name": "Microblading", "category": "Brwi", "price": 400, "duration": 120,
         "desc": "Makijaż permanentny brwi"},

        {"name": "Oczyszczanie wodorowe", "category": "Twarz", "price": 120, "duration": 60,
         "desc": "Głębokie oczyszczanie twarzy"},
        {"name": "Mezoterapia igłowa", "category": "Twarz", "price": 200, "duration": 45,
         "desc": "Zabieg mezoterapii"},
        {"name": "Peeling kawitacyjny", "category": "Twarz", "price": 100, "duration": 45,
         "desc": "Peeling ultradźwiękowy"},
        {"name": "Masaż twarzy", "category": "Twarz", "price": 80, "duration": 45,
         "desc": "Relaksujący masaż twarzy"},

        {"name": "Depilacja woskiem - nogi", "category": "Depilacja", "price": 80, "duration": 45,
         "desc": "Depilacja całych nóg"},
        {"name": "Depilacja woskiem - pachy", "category": "Depilacja", "price": 40, "duration": 20,
         "desc": "Depilacja pach"},
        {"name": "Depilacja laserowa - nogi", "category": "Depilacja", "price": 300, "duration": 60,
         "desc": "Laserowe usuwanie owłosienia"},

        {"name": "Masaż relaksacyjny", "category": "Masaż", "price": 150, "duration": 60,
         "desc": "Masaż całego ciała"},
    ]

    services: list[Service] = []
    for s in services_data:
        obj, _ = Service.objects.get_or_create(
            name=s["name"],
            defaults={
                "category": s["category"],
                "description": s["desc"],
                "price": Decimal(str(s["price"])),
                "duration_minutes": int(s["duration"]),
                "is_active": True,
            },
        )
        services.append(obj)

    # Skills (przykładowy podział usług)
    if employee_profiles:
        employee_profiles[0].skills.set(services[:7])
    if len(employee_profiles) > 1:
        employee_profiles[1].skills.set(services[7:14])
    if len(employee_profiles) > 2:
        employee_profiles[2].skills.set(services[14:])

    # -------------------------------------------------------------------------
    # EMPLOYEE SCHEDULES
    # -------------------------------------------------------------------------
    schedule = {
        "mon": [{"start": "09:00", "end": "17:00"}],
        "tue": [{"start": "09:00", "end": "17:00"}],
        "wed": [{"start": "09:00", "end": "17:00"}],
        "thu": [{"start": "09:00", "end": "17:00"}],
        "fri": [{"start": "09:00", "end": "17:00"}],
        "sat": [{"start": "10:00", "end": "15:00"}],
        "sun": [],
    }
    for emp in employee_profiles:
        EmployeeSchedule.objects.get_or_create(employee=emp, defaults={"weekly_hours": schedule})

    # -------------------------------------------------------------------------
    # CLIENTS
    # -------------------------------------------------------------------------
    clients_data = [
        {
            "num": "00000001",
            "first_name": "Katarzyna",
            "last_name": "Zielińska",
            "email": "katarzyna.zielinska@gmail.com",
            "phone": "+48601234567",
        },
        {
            "num": "00000002",
            "first_name": "Magdalena",
            "last_name": "Lewandowska",
            "email": "magdalena.lewandowska@gmail.com",
            "phone": "+48602345678",
        },
        {
            "num": "00000003",
            "first_name": "Agnieszka",
            "last_name": "Kamińska",
            "email": "agnieszka.kaminska@gmail.com",
            "phone": "+48603456789",
        },
        {
            "num": "00000004",
            "first_name": "Julia",
            "last_name": "Kowalczyk",
            "email": "julia.kowalczyk@gmail.com",
            "phone": "+48604567890",
        },
        {
            "num": "00000005",
            "first_name": "Natalia",
            "last_name": "Wójcik",
            "email": "natalia.wojcik@gmail.com",
            "phone": "+48605678901",
        },
    ]

    client_profiles: list[ClientProfile] = []
    for c in clients_data:
        username = f"klient-{c['num']}"

        u, created = CustomUser.objects.get_or_create(
            username=username,
            defaults={
                "first_name": c["first_name"],
                "last_name": c["last_name"],
                "email": c["email"],
                "role": "CLIENT",
                "is_active": True,
            },
        )
        if created:
            u.set_password("client123")
        else:
            u.role = "CLIENT"
            u.is_active = True
            # email/imię/nazwisko zsynchronizujmy
            u.first_name = c["first_name"]
            u.last_name = c["last_name"]
            u.email = c["email"]

        u.full_clean()
        u.save()

        profile, _ = ClientProfile.objects.get_or_create(
            user=u,
            defaults={
                "client_number": c["num"],   # możesz zostawić puste jeśli masz signal generator
                "first_name": c["first_name"],
                "last_name": c["last_name"],
                "email": c["email"],
                "phone": c["phone"],
                "internal_notes": "",
                "is_active": True,
            },
        )

        # jeśli profil istniał i nie ma numeru, ustaw
        if not profile.client_number:
            profile.client_number = c["num"]
            profile.save(update_fields=["client_number"])

        client_profiles.append(profile)

    # -------------------------------------------------------------------------
    # APPOINTMENTS
    # -------------------------------------------------------------------------
    def calc_end(start_dt, service_obj: Service):
        return start_dt + timedelta(minutes=int(service_obj.duration_minutes) + buffer_minutes)

    if client_profiles and employee_profiles and services:
        appts = [
            # przeszłe (COMPLETED)
            (client_profiles[0], employee_profiles[0], services[1], -7, 10, "COMPLETED"),
            (client_profiles[1], employee_profiles[1], services[5], -5, 14, "COMPLETED"),
            (client_profiles[2], employee_profiles[2], services[12], -3, 11, "COMPLETED"),

            # przyszłe (CONFIRMED / PENDING)
            (client_profiles[0], employee_profiles[0], services[2], 2, 10, "CONFIRMED"),
            (client_profiles[1], employee_profiles[1], services[7], 3, 15, "CONFIRMED"),
            (client_profiles[3], employee_profiles[2], services[13], 5, 12, "PENDING"),
            (client_profiles[4], employee_profiles[0], services[4], 7, 14, "PENDING"),
        ]

        for client, emp, svc, days, hour, status in appts:
            start = _dt(days, hour)
            Appointment.objects.get_or_create(
                client=client,
                employee=emp,
                service=svc,
                start=start,
                defaults={
                    "end": calc_end(start, svc),
                    "status": status,
                },
            )

        # przykładowa anulowana
        start = _dt(1, 16)
        Appointment.objects.get_or_create(
            client=client_profiles[2],
            employee=employee_profiles[0],
            service=services[0],
            start=start,
            defaults={
                "end": calc_end(start, services[0]),
                "status": "CANCELLED",
                "internal_notes": "Klient odwołał wizytę.",
            },
        )

    # -------------------------------------------------------------------------
    # TIME OFF
    # -------------------------------------------------------------------------
    if len(employee_profiles) > 1:
        TimeOff.objects.get_or_create(
            employee=employee_profiles[1],
            date_from=(timezone.localdate() + timedelta(days=10)),
            date_to=(timezone.localdate() + timedelta(days=17)),
            defaults={"reason": "Urlop wypoczynkowy"},
        )

    print("Seed OK.")
    print("ADMIN:   admin-00000001 / admin123")
    print("EMPLOYEE: anna.kowalska / employee123")
    print("CLIENT:  klient-00000001 / client123")


class Command(BaseCommand):
    help = "Seed danych startowych"

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true")

    def handle(self, *args, **options):
        seed(clear=options["clear"])
        self.stdout.write(self.style.SUCCESS("Seed zakończony."))
