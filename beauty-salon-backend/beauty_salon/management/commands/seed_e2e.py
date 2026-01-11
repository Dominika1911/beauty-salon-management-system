from datetime import timedelta

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

from beauty_salon.models import (
    ClientProfile,
    EmployeeProfile,
    EmployeeSchedule,
    Service,
    SystemSettings,
)

from beauty_salon.models import Appointment, TimeOff


OPENING_HOURS = {
    "mon": [{"start": "09:00", "end": "17:00"}],
    "tue": [{"start": "09:00", "end": "17:00"}],
    "wed": [{"start": "09:00", "end": "17:00"}],
    "thu": [{"start": "09:00", "end": "17:00"}],
    "fri": [{"start": "09:00", "end": "17:00"}],
    "sat": [{"start": "10:00", "end": "14:00"}],
    "sun": [],
}

WEEKLY_HOURS = OPENING_HOURS


class Command(BaseCommand):
    help = (
        "Seed deterministic data for Playwright E2E: clients + E2E service + "
        "E2E employee + schedule + opening hours. Idempotent + resets E2E conflicts."
    )

    def add_arguments(self, parser):
        parser.add_argument("--username", default="e2e-client")
        parser.add_argument("--password", default="E2Epass123!")

        # Ile dni do przodu czyścimy rezerwacje E2E (wystarczy pod testy)
        parser.add_argument("--cleanup-days", type=int, default=60)

    def handle(self, *args, **options):
        base_username = options["username"]
        password = options["password"]
        cleanup_days = options["cleanup_days"]

        User = get_user_model()

        # --- System settings (deterministycznie, ZAWSZE) ---
        settings_obj = SystemSettings.get_settings()
        settings_obj.opening_hours = OPENING_HOURS
        settings_obj.slot_minutes = 15
        settings_obj.buffer_minutes = 0
        settings_obj.save()

        # --- E2E service (zawsze aktywna, deterministyczna) ---
        service, service_created = Service.objects.get_or_create(
            name="E2E - Usługa testowa",
            defaults={
                "category": "E2E",
                "description": "Deterministyczna usługa do testów E2E.",
                "price": "100.00",
                "duration_minutes": 30,
                "is_active": True,
            },
        )
        # Utrzymaj deterministyczne parametry także przy kolejnych uruchomieniach:
        changed_service = False
        if service.category != "E2E":
            service.category = "E2E"
            changed_service = True
        if service.description != "Deterministyczna usługa do testów E2E.":
            service.description = "Deterministyczna usługa do testów E2E."
            changed_service = True
        if str(service.price) != "100.00":
            service.price = "100.00"
            changed_service = True
        if service.duration_minutes != 30:
            service.duration_minutes = 30
            changed_service = True
        if not service.is_active:
            service.is_active = True
            changed_service = True
        if changed_service:
            service.save()

        # --- E2E employee ---
        emp_username = "pracownik-00000001"
        emp_user, emp_user_created = User.objects.get_or_create(username=emp_username)
        emp_user.set_password(password)
        emp_user.is_active = True
        emp_user.role = getattr(User, "Role", None).EMPLOYEE if hasattr(User, "Role") else "EMPLOYEE"
        emp_user.save()

        emp_profile, emp_profile_created = EmployeeProfile.objects.get_or_create(
            user=emp_user,
            defaults={"first_name": "E2E", "last_name": "Pracownik", "is_active": True},
        )
        changed_emp = False
        if getattr(emp_profile, "first_name", None) != "E2E":
            emp_profile.first_name = "E2E"
            changed_emp = True
        if getattr(emp_profile, "last_name", None) != "Pracownik":
            emp_profile.last_name = "Pracownik"
            changed_emp = True
        if hasattr(emp_profile, "is_active") and not emp_profile.is_active:
            emp_profile.is_active = True
            changed_emp = True
        if changed_emp:
            emp_profile.save()

        # Skills: ustaw deterministycznie (żeby nie zostały śmieciowe umiejętności)
        # Jeśli w Twojej domenie pracownik może mieć wiele usług, to i tak warto zapewnić,
        # że E2E-usługa jest na pewno przypisana.
        emp_profile.skills.add(service)

        # Schedule: ZAWSZE nadpisz weekly_hours dla deterministyczności
        schedule, schedule_created = EmployeeSchedule.objects.get_or_create(employee=emp_profile)
        schedule.weekly_hours = WEEKLY_HOURS
        schedule.save()

        # --- Reset konfliktów E2E: usuń rezerwacje i nieobecności testowego pracownika ---
        # To jest kluczowe: zapewnia, że /availability/slots/ ma co zwrócić,
        # a /appointments/book/ nie dostaje "termin niedostępny" po kilku runach.
        now = timezone.now()
        window_end = now + timedelta(days=cleanup_days)

        # Jeśli Appointment ma inne pola niż 'employee' i 'start', dopasuj filtr.
        # W Twoich logach booking dotyczy konkretnego pracownika i slotu w przyszłości,
        # więc czyszczenie z okna czasowego jest najbezpieczniejsze.
        deleted_appointments = Appointment.objects.filter(
            employee=emp_profile,
            start__gte=now - timedelta(days=1),
            start__lte=window_end,
        ).delete()[0]

        deleted_timeoffs = TimeOff.objects.filter(employee=emp_profile).delete()[0]

        # --- E2E client users + profiles ---
        usernames = [
            base_username,
            f"{base_username}-desktop",
            f"{base_username}-tablet",
            f"{base_username}-mobile",
        ]

        created_any_user = False
        created_profiles = 0
        fixed_profiles = 0

        for username in usernames:
            user, created = User.objects.get_or_create(username=username)
            created_any_user = created_any_user or created

            user.set_password(password)
            user.is_active = True
            user.role = getattr(User, "Role", None).CLIENT if hasattr(User, "Role") else "CLIENT"
            user.save()

            profile, prof_created = ClientProfile.objects.get_or_create(
                user=user,
                defaults={"first_name": "E2E", "last_name": "Klient", "is_active": True},
            )

            if prof_created:
                created_profiles += 1
            else:
                changed = False
                if hasattr(profile, "is_active") and not profile.is_active:
                    profile.is_active = True
                    changed = True
                if getattr(profile, "first_name", None) != "E2E":
                    profile.first_name = "E2E"
                    changed = True
                if getattr(profile, "last_name", None) != "Klient":
                    profile.last_name = "Klient"
                    changed = True
                if changed:
                    profile.save()
                    fixed_profiles += 1

        self.stdout.write(
            self.style.SUCCESS(
                "OK "
                f"base_username={base_username} users_created_any={created_any_user} "
                f"client_profiles_created={created_profiles} client_profiles_fixed={fixed_profiles} | "
                f"service_created={service_created} service_id={service.id} | "
                f"employee_created={emp_user_created} employee_profile_created={emp_profile_created} "
                f"schedule_created={schedule_created} | "
                f"deleted_appointments={deleted_appointments} deleted_timeoffs={deleted_timeoffs}"
            )
        )
