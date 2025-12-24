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
    now = timezone.localtime(timezone.now())
    d = now + timedelta(days=days_offset)
    return d.replace(hour=hour, minute=minute, second=0, microsecond=0)


@transaction.atomic
def seed(clear: bool = False) -> None:
    if clear:
        Appointment.objects.all().delete()
        TimeOff.objects.all().delete()
        EmployeeSchedule.objects.all().delete()
        ClientProfile.objects.all().delete()
        EmployeeProfile.objects.all().delete()
        Service.objects.all().delete()
        CustomUser.objects.filter(is_superuser=False).delete()

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
        admin.save()

    employees_data = [
        {"username": "anna.kowalska", "first_name": "Anna", "last_name": "Kowalska", "email": "anna.kowalska@beautysalon.pl", "phone": "+48501234567"},
        {"username": "maria.nowak", "first_name": "Maria", "last_name": "Nowak", "email": "maria.nowak@beautysalon.pl", "phone": "+48502345678"},
        {"username": "zofia.wisniewski", "first_name": "Zofia", "last_name": "Wisniewski", "email": "zofia.wisniewski@beautysalon.pl", "phone": "+48503456789"},
    ]
    employee_users = []
    for e in employees_data:
        u, created = CustomUser.objects.get_or_create(
            username=e["username"],
            defaults={
                "first_name": e["first_name"],
                "last_name": e["last_name"],
                "email": e["email"],
                "role": "EMPLOYEE",
                "is_active": True,
            },
        )
        if created:
            u.set_password("employee123")
            u.save()
        employee_users.append(u)

    clients_data = [
        {"username": "klient-00000001", "first_name": "Katarzyna", "last_name": "Zielinska", "email": "katarzyna.zielinska@gmail.com", "phone": "+48601234567"},
        {"username": "klient-00000002", "first_name": "Magdalena", "last_name": "Lewandowska", "email": "magdalena.lewandowska@gmail.com", "phone": "+48602345678"},
        {"username": "klient-00000003", "first_name": "Agnieszka", "last_name": "Kaminska", "email": "agnieszka.kaminska@gmail.com", "phone": "+48603456789"},
    ]
    client_users = []
    for c in clients_data:
        u, created = CustomUser.objects.get_or_create(
            username=c["username"],
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
            u.save()
        client_users.append(u)

    services_data = [
        {"name": "Manicure klasyczny", "category": "Paznokcie", "price": 50, "duration": 45, "desc": "Podstawowy manicure z malowaniem"},
        {"name": "Manicure hybrydowy", "category": "Paznokcie", "price": 80, "duration": 60, "desc": "Manicure z użyciem lakieru hybrydowego"},
        {"name": "Manicure żelowy", "category": "Paznokcie", "price": 100, "duration": 90, "desc": "Przedłużanie paznokci metodą żelową"},
        {"name": "Pedicure klasyczny", "category": "Paznokcie", "price": 60, "duration": 60, "desc": "Podstawowy pedicure z malowaniem"},
        {"name": "Pedicure hybrydowy", "category": "Paznokcie", "price": 90, "duration": 75, "desc": "Pedicure z lakierem hybrydowym"},
        {"name": "Przedłużanie rzęs 1:1", "category": "Rzęsy", "price": 120, "duration": 90, "desc": "Klasyczne przedłużanie metodą 1:1"},
        {"name": "Przedłużanie rzęs 2D-3D", "category": "Rzęsy", "price": 150, "duration": 120, "desc": "Przedłużanie metodą objętościową"},
        {"name": "Lifting rzęs", "category": "Rzęsy", "price": 100, "duration": 60, "desc": "Laminacja i lifting naturalnych rzęs"},
        {"name": "Uzupełnienie rzęs", "category": "Rzęsy", "price": 80, "duration": 60, "desc": "Uzupełnienie po 2-3 tygodniach"},
        {"name": "Stylizacja brwi", "category": "Brwi", "price": 40, "duration": 30, "desc": "Regulacja kształtu brwi"},
        {"name": "Henna brwi", "category": "Brwi", "price": 50, "duration": 45, "desc": "Farbowanie henną"},
        {"name": "Microblading", "category": "Brwi", "price": 400, "duration": 120, "desc": "Makijaż permanentny brwi"},
        {"name": "Oczyszczanie wodorowe", "category": "Twarz", "price": 120, "duration": 60, "desc": "Głębokie oczyszczanie twarzy"},
        {"name": "Mezoterapia igłowa", "category": "Twarz", "price": 200, "duration": 45, "desc": "Zabieg mezoterapii"},
        {"name": "Peeling kawitacyjny", "category": "Twarz", "price": 100, "duration": 45, "desc": "Peeling ultradźwiękowy"},
        {"name": "Masaż twarzy", "category": "Twarz", "price": 80, "duration": 45, "desc": "Relaksujący masaż twarzy"},
        {"name": "Depilacja woskiem - nogi", "category": "Depilacja", "price": 80, "duration": 45, "desc": "Depilacja całych nóg"},
        {"name": "Depilacja woskiem - pachy", "category": "Depilacja", "price": 40, "duration": 20, "desc": "Depilacja pach"},
        {"name": "Depilacja laserowa - nogi", "category": "Depilacja", "price": 300, "duration": 60, "desc": "Laserowe usuwanie owłosienia"},
        {"name": "Masaż relaksacyjny", "category": "Masaż", "price": 150, "duration": 60, "desc": "Masaż całego ciała"},
    ]

    services = []
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

    employees = []
    for idx, (u, e) in enumerate(zip(employee_users, employees_data)):
        profile, _ = EmployeeProfile.objects.get_or_create(
            user=u,
            defaults={
                "first_name": e["first_name"],
                "last_name": e["last_name"],
                "phone": e["phone"],
                "is_active": True,
            },
        )
        EmployeeProfile.objects.filter(pk=profile.pk).update(hired_at=(timezone.localdate() - timedelta(days=365)))

        if idx == 0:
            profile.skills.set(services[:5])
        elif idx == 1:
            profile.skills.set(services[5:12])
        else:
            profile.skills.set(services[12:])
        employees.append(profile)

    schedule = {
        "mon": [{"start": "09:00", "end": "17:00"}],
        "tue": [{"start": "09:00", "end": "17:00"}],
        "wed": [{"start": "09:00", "end": "17:00"}],
        "thu": [{"start": "09:00", "end": "17:00"}],
        "fri": [{"start": "09:00", "end": "17:00"}],
        "sat": [{"start": "10:00", "end": "15:00"}],
        "sun": [],
    }
    for emp in employees:
        EmployeeSchedule.objects.get_or_create(employee=emp, defaults={"weekly_hours": schedule})

    clients = []
    for u, c in zip(client_users, clients_data):
        profile, _ = ClientProfile.objects.get_or_create(
            user=u,
            defaults={
                "first_name": c["first_name"],
                "last_name": c["last_name"],
                "email": c["email"],
                "phone": c["phone"],
                "is_active": True,
            },
        )
        clients.append(profile)

    for c in [
        {"first_name": "Julia", "last_name": "Kowalczyk", "phone": "+48604567890", "email": "julia.k@gmail.com"},
        {"first_name": "Natalia", "last_name": "Wojcik", "phone": "+48605678901", "email": "natalia.w@gmail.com"},
    ]:
        profile, _ = ClientProfile.objects.get_or_create(
            email=c["email"],
            defaults={
                "user": None,
                "first_name": c["first_name"],
                "last_name": c["last_name"],
                "phone": c["phone"],
                "is_active": True,
            },
        )
        clients.append(profile)

    def end_dt(start, service: Service):
        return start + timedelta(minutes=int(service.duration_minutes) + buffer_minutes)

    appts = [
        (clients[0], employees[0], services[1], -7, 10, "COMPLETED"),
        (clients[1], employees[1], services[5], -5, 14, "COMPLETED"),
        (clients[2], employees[2], services[12], -3, 11, "COMPLETED"),
        (clients[0], employees[0], services[2], 2, 10, "CONFIRMED"),
        (clients[1], employees[1], services[7], 3, 15, "CONFIRMED"),
        (clients[3], employees[2], services[13], 5, 12, "PENDING"),
        (clients[4], employees[0], services[4], 7, 14, "PENDING"),
    ]
    for client, emp, svc, days, hour, status in appts:
        start = _dt(days, hour)
        Appointment.objects.get_or_create(
            client=client,
            employee=emp,
            service=svc,
            start=start,
            defaults={"end": end_dt(start, svc), "status": status},
        )

    start = _dt(1, 16)
    Appointment.objects.get_or_create(
        client=clients[2],
        employee=employees[0],
        service=services[0],
        start=start,
        defaults={"end": end_dt(start, services[0]), "status": "CANCELLED", "internal_notes": "Klient odwołał wizytę."},
    )

    TimeOff.objects.get_or_create(
        employee=employees[1],
        date_from=(timezone.localdate() + timedelta(days=10)),
        date_to=(timezone.localdate() + timedelta(days=17)),
        defaults={"reason": "Urlop wypoczynkowy"},
    )

    print("Seed OK.")
    print("ADMIN: admin-00000001 / admin123")
    print("EMPLOYEE: anna.kowalska / employee123")
    print("CLIENT: klient-00000001 / client123")


class Command(BaseCommand):
    help = "Seed danych startowych"

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true")

    def handle(self, *args, **options):
        seed(clear=options["clear"])
        self.stdout.write(self.style.SUCCESS("Seed zakończony."))
