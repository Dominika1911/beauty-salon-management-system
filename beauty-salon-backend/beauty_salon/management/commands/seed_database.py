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
def seed(clear: bool = False, demo: bool = False, password: str = "demo123") -> None:
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
    buffer_minutes = int(settings_obj.buffer_minutes or 10)

    admin, created = CustomUser.objects.get_or_create(
        username="admin-00000001",
        defaults={
            "first_name": "Administrator",
            "last_name": "Systemu",
            "email": "admin@beautysalon.pl",
            "role": CustomUser.Role.ADMIN,
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
        },
    )
    if created:
        admin.set_password(password)
        admin.full_clean()
        admin.save()
    else:
        if (
            not admin.is_staff
            or not admin.is_superuser
            or admin.role != CustomUser.Role.ADMIN
        ):
            admin.is_staff = True
            admin.is_superuser = True
            admin.role = CustomUser.Role.ADMIN
            admin.full_clean()
            admin.save()

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

    employee_profiles = []
    for e in employees_data:
        u, created = CustomUser.objects.get_or_create(
            username=e["username"],
            defaults={
                "first_name": e["first_name"],
                "last_name": e["last_name"],
                "email": e["email"],
                "role": CustomUser.Role.EMPLOYEE,
                "is_active": True,
                "is_staff": True,
            },
        )
        if created:
            u.set_password(password)
        else:
            u.role = CustomUser.Role.EMPLOYEE
            u.is_active = True
            u.is_staff = True

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

        if not profile.employee_number:
            profile.employee_number = e["employee_number"]
            profile.save(update_fields=["employee_number"])

        employee_profiles.append(profile)

    services_data = [
        {
            "name": "Manicure klasyczny",
            "category": "Paznokcie",
            "price": 50,
            "duration": 45,
        },
        {
            "name": "Manicure hybrydowy",
            "category": "Paznokcie",
            "price": 80,
            "duration": 60,
        },
        {
            "name": "Manicure żelowy",
            "category": "Paznokcie",
            "price": 100,
            "duration": 90,
        },
        {
            "name": "Pedicure klasyczny",
            "category": "Paznokcie",
            "price": 60,
            "duration": 60,
        },
        {
            "name": "Pedicure hybrydowy",
            "category": "Paznokcie",
            "price": 90,
            "duration": 75,
        },
        {
            "name": "Przedłużanie rzęs 1:1",
            "category": "Rzęsy",
            "price": 120,
            "duration": 90,
        },
        {
            "name": "Przedłużanie rzęs 2D-3D",
            "category": "Rzęsy",
            "price": 150,
            "duration": 120,
        },
        {"name": "Lifting rzęs", "category": "Rzęsy", "price": 100, "duration": 60},
        {"name": "Uzupełnienie rzęs", "category": "Rzęsy", "price": 80, "duration": 60},
        {"name": "Stylizacja brwi", "category": "Brwi", "price": 40, "duration": 30},
        {"name": "Henna brwi", "category": "Brwi", "price": 50, "duration": 45},
        {"name": "Microblading", "category": "Brwi", "price": 400, "duration": 120},
        {
            "name": "Oczyszczanie wodorowe",
            "category": "Twarz",
            "price": 120,
            "duration": 60,
        },
        {
            "name": "Mezoterapia igłowa",
            "category": "Twarz",
            "price": 200,
            "duration": 45,
        },
        {
            "name": "Peeling kawitacyjny",
            "category": "Twarz",
            "price": 100,
            "duration": 45,
        },
        {"name": "Masaż twarzy", "category": "Twarz", "price": 80, "duration": 45},
        {
            "name": "Depilacja woskiem - nogi",
            "category": "Depilacja",
            "price": 80,
            "duration": 45,
        },
        {
            "name": "Depilacja woskiem - pachy",
            "category": "Depilacja",
            "price": 40,
            "duration": 20,
        },
        {
            "name": "Depilacja laserowa - nogi",
            "category": "Depilacja",
            "price": 300,
            "duration": 60,
        },
        {
            "name": "Masaż relaksacyjny",
            "category": "Masaż",
            "price": 150,
            "duration": 60,
        },
    ]

    services = []
    for s in services_data:
        obj, _ = Service.objects.get_or_create(
            name=s["name"],
            defaults={
                "category": s["category"],
                "description": f"Profesjonalna {s['name'].lower()}",
                "price": Decimal(str(s["price"])),
                "duration_minutes": s["duration"],
                "is_active": True,
            },
        )
        services.append(obj)

    if employee_profiles:
        employee_profiles[0].skills.set(services[0:12])
    if len(employee_profiles) > 1:
        employee_profiles[1].skills.set(services[12:19])
    if len(employee_profiles) > 2:
        employee_profiles[2].skills.set(
            [services[5], services[6], services[7], services[8], services[19]]
        )

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
        EmployeeSchedule.objects.get_or_create(
            employee=emp, defaults={"weekly_hours": schedule}
        )

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

    client_profiles = []
    for c in clients_data:
        username = f"klient-{c['num']}"
        u, created = CustomUser.objects.get_or_create(
            username=username,
            defaults={
                "first_name": c["first_name"],
                "last_name": c["last_name"],
                "email": c["email"],
                "role": CustomUser.Role.CLIENT,
                "is_active": True,
            },
        )
        if created:
            u.set_password(password)
        else:
            u.role = CustomUser.Role.CLIENT
            u.is_active = True
            u.first_name = c["first_name"]
            u.last_name = c["last_name"]
            u.email = c["email"]

        u.full_clean()
        u.save()

        profile, _ = ClientProfile.objects.get_or_create(
            user=u,
            defaults={
                "client_number": c["num"],
                "first_name": c["first_name"],
                "last_name": c["last_name"],
                "email": c["email"],
                "phone": c["phone"],
                "is_active": True,
            },
        )

        if not profile.client_number:
            profile.client_number = c["num"]
            profile.save(update_fields=["client_number"])

        client_profiles.append(profile)

    def calc_end(start_dt, service_obj):
        return start_dt + timedelta(
            minutes=int(service_obj.duration_minutes) + buffer_minutes
        )

    if client_profiles and employee_profiles and services:
        appointments = [
            (
                client_profiles[0],
                employee_profiles[0],
                services[1],
                -7,
                10,
                0,
                Appointment.Status.COMPLETED,
            ),
            (
                client_profiles[1],
                employee_profiles[1],
                services[13],
                -5,
                14,
                0,
                Appointment.Status.COMPLETED,
            ),
            (
                client_profiles[2],
                employee_profiles[2],
                services[5],
                -3,
                11,
                0,
                Appointment.Status.COMPLETED,
            ),
            (
                client_profiles[0],
                employee_profiles[0],
                services[3],
                -10,
                15,
                0,
                Appointment.Status.COMPLETED,
            ),
            (
                client_profiles[3],
                employee_profiles[0],
                services[0],
                -2,
                16,
                0,
                Appointment.Status.CANCELLED,
            ),
            (
                client_profiles[4],
                employee_profiles[1],
                services[12],
                -1,
                14,
                0,
                Appointment.Status.NO_SHOW,
            ),
            (
                client_profiles[0],
                employee_profiles[0],
                services[2],
                2,
                10,
                0,
                Appointment.Status.CONFIRMED,
            ),
            (
                client_profiles[1],
                employee_profiles[1],
                services[14],
                3,
                15,
                0,
                Appointment.Status.CONFIRMED,
            ),
            (
                client_profiles[2],
                employee_profiles[2],
                services[7],
                4,
                12,
                0,
                Appointment.Status.CONFIRMED,
            ),
            (
                client_profiles[3],
                employee_profiles[0],
                services[4],
                5,
                14,
                0,
                Appointment.Status.PENDING,
            ),
            (
                client_profiles[4],
                employee_profiles[1],
                services[16],
                7,
                11,
                0,
                Appointment.Status.PENDING,
            ),
        ]

        for client, emp, svc, days, hour, minute, appt_status in appointments:
            start = _dt(days, hour, minute)
            Appointment.objects.get_or_create(
                client=client,
                employee=emp,
                service=svc,
                start=start,
                defaults={
                    "end": calc_end(start, svc),
                    "status": appt_status,
                },
            )

    today = timezone.localdate()

    if employee_profiles:
        TimeOff.objects.get_or_create(
            employee=employee_profiles[0],
            date_from=today + timedelta(days=20),
            date_to=today + timedelta(days=25),
            defaults={
                "reason": "Urlop wypoczynkowy",
                "status": TimeOff.Status.PENDING,
                "requested_by": employee_profiles[0].user,
            },
        )

    if len(employee_profiles) > 1:
        TimeOff.objects.get_or_create(
            employee=employee_profiles[1],
            date_from=today + timedelta(days=30),
            date_to=today + timedelta(days=35),
            defaults={
                "reason": "Wakacje",
                "status": TimeOff.Status.APPROVED,
                "requested_by": employee_profiles[1].user,
                "decided_by": admin,
                "decided_at": timezone.now(),
            },
        )

    if len(employee_profiles) > 2:
        TimeOff.objects.get_or_create(
            employee=employee_profiles[2],
            date_from=today + timedelta(days=10),
            date_to=today + timedelta(days=12),
            defaults={
                "reason": "Sprawy rodzinne",
                "status": TimeOff.Status.REJECTED,
                "requested_by": employee_profiles[2].user,
                "decided_by": admin,
                "decided_at": timezone.now() - timedelta(days=1),
            },
        )

    if employee_profiles:
        TimeOff.objects.get_or_create(
            employee=employee_profiles[0],
            date_from=today + timedelta(days=5),
            date_to=today + timedelta(days=7),
            defaults={
                "reason": "Pilne sprawy",
                "status": TimeOff.Status.CANCELLED,
                "requested_by": employee_profiles[0].user,
                "decided_by": employee_profiles[0].user,
                "decided_at": timezone.now() - timedelta(hours=2),
            },
        )

    print("Seed completed successfully.")
    print(f"Admin: admin-00000001 / {password}")
    print(f"Employee: anna.kowalska / {password}")
    print(f"Client: klient-00000001 / {password}")


class Command(BaseCommand):
    help = "Seed initial data for the beauty salon system"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear", action="store_true", help="Clear existing data before seeding"
        )
        parser.add_argument(
            "--demo", action="store_true", help="Include additional demo data"
        )
        parser.add_argument(
            "--password", type=str, default="demo123", help="Password for all users"
        )

    def handle(self, *args, **options):
        seed(clear=options["clear"], demo=options["demo"], password=options["password"])
        self.stdout.write(self.style.SUCCESS("Data seeding completed."))
