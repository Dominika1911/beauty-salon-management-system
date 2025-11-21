from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.core.validators import RegexValidator
from django.db.models import Q, Count
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

phone_validator = RegexValidator(
    r'^\+?[1-9]\d{8,14}$',
    _("Numer telefonu musi być w formacie międzynarodowym (+XXXXXXXXX, 9-15 cyfr)."),
)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_employee_number():
    """
    Generuje numer pracownika w formacie EMP-XXXX (4 cyfry).
    UWAGA: Ta funkcja jest używana jako fallback - główna logika jest w signals.py
    """
    from .models import Employee

    last_employee = Employee.objects.order_by("-number").first()
    if not last_employee:
        return "EMP-0001"

    try:
        last_num = int(last_employee.number.split("-")[1])
        return f"EMP-{last_num + 1:04d}"
    except (IndexError, ValueError, TypeError):
        count = Employee.objects.count()
        return f"EMP-{count + 1:04d}"


def generate_client_number():
    """
    Generuje numer klienta w formacie CLI-XXXX (4 cyfry).
    UWAGA: Ta funkcja jest używana jako fallback - główna logika jest w signals.py
    Używamy .objects (a nie .active) aby policzyć też usuniętych i uniknąć kolizji
    """
    from .models import Client

    last_client = Client.objects.order_by("-number").first()
    if not last_client:
        return "CLI-0001"

    try:
        last_num = int(last_client.number.split("-")[1])
        return f"CLI-{last_num + 1:04d}"
    except (IndexError, ValueError, TypeError):
        count = Client.objects.count()
        return f"CLI-{count + 1:04d}"


def generate_invoice_number(date=None):
    """
    Generuje numer faktury w formacie INV/YYYY/MM/XXXX.
    """
    from .models import Invoice

    if date is None:
        date = timezone.now().date()

    year = date.year
    month = date.month
    prefix = f"INV/{year}/{month:02d}/"

    last_invoice = (
        Invoice.objects.filter(number__startswith=prefix)
        .order_by("-number")
        .first()
    )
    if not last_invoice:
        return f"{prefix}0001"

    try:
        last_num = int(last_invoice.number.split("/")[-1])
        return f"{prefix}{last_num + 1:04d}"
    except (IndexError, ValueError, TypeError):
        count = Invoice.objects.filter(number__startswith=prefix).count()
        return f"{prefix}{count + 1:04d}"


def calculate_vat(net_amount, vat_rate):
    """
    Oblicza kwotę VAT i kwotę brutto na podstawie kwoty netto i stawki VAT.

    Args:
        net_amount: Kwota netto (Decimal lub float/int)
        vat_rate: Stawka VAT w procentach (Decimal lub float/int), np. 23.00

    Returns:
        tuple: (vat_amount, gross_amount) jako Decimal

    Raises:
        ValueError: Jeśli dane wejściowe są nieprawidłowe
    """
    try:
        net_amount = Decimal(str(net_amount))
        vat_rate = Decimal(str(vat_rate))
    except (ValueError, InvalidOperation, TypeError):
        raise ValueError("Nieprawidłowe dane wejściowe dla obliczeń VAT.")

    if net_amount < 0:
        raise ValueError("Kwota nie może być ujemna.")

    if not (Decimal("0.00") <= vat_rate <= Decimal("100.00")):
        raise ValueError("Stawka VAT musi być w zakresie 0-100%.")

    vat_amount = (net_amount * vat_rate / Decimal("100")).quantize(Decimal("0.01"))
    gross_amount = net_amount + vat_amount
    return vat_amount, gross_amount


def get_available_time_slots(employee, date, service):
    """
    Zwraca listę dostępnych slotów czasowych dla pracownika w danym dniu.

    Args:
        employee: Obiekt Employee
        date: Data (datetime.date)
        service: Obiekt Service

    Returns:
        list: Lista datetime obiektów reprezentujących dostępne sloty
    """
    from .models import SystemSettings, Schedule, Appointment, TimeOff

    settings = SystemSettings.load()

    # Sprawdzenie dostępności pracownika (urlopy/niedostępności)
    if TimeOff.objects.filter(
            employee=employee,
            status__in=[TimeOff.Status.PENDING, TimeOff.Status.APPROVED],
            date_from__lte=date,
            date_to__gte=date,
    ).exists():
        return []

    schedule = Schedule.objects.filter(
        employee=employee,
        status=Schedule.Status.ACTIVE,
    ).first()
    if not schedule:
        return []

    weekday_map = {
        0: "Monday",
        1: "Tuesday",
        2: "Wednesday",
        3: "Thursday",
        4: "Friday",
        5: "Saturday",
        6: "Sunday",
    }
    day_name = weekday_map[date.weekday()]

    day_schedule = next(
        (period for period in schedule.availability_periods if period.get("day") == day_name),
        None,
    )
    if not day_schedule:
        return []

    try:
        start_time = datetime.strptime(day_schedule["start"], "%H:%M").time()
        end_time = datetime.strptime(day_schedule["end"], "%H:%M").time()
    except (ValueError, TypeError, KeyError):
        return []

    work_start = timezone.make_aware(datetime.combine(date, start_time))
    work_end = timezone.make_aware(datetime.combine(date, end_time))

    slot_duration = timedelta(minutes=settings.slot_minutes)
    buffer_duration = timedelta(minutes=settings.buffer_minutes)
    service_duration = service.duration

    all_slots = []
    current_slot = work_start
    while current_slot + service_duration <= work_end:
        all_slots.append(current_slot)
        current_slot += slot_duration

    existing_appointments = (
        Appointment.objects.filter(
            employee=employee,
            start__date=date,
            status__in=[
                Appointment.Status.PENDING,
                Appointment.Status.CONFIRMED,
                Appointment.Status.IN_PROGRESS,
            ],
        )
        .values_list("start", "end")
    )

    breaks = []
    for break_item in schedule.breaks:
        try:
            break_start = datetime.strptime(break_item["start"], "%H:%M").time()
            break_end = datetime.strptime(break_item["end"], "%H:%M").time()
        except (ValueError, TypeError, KeyError):
            continue

        breaks.append(
            (
                timezone.make_aware(datetime.combine(date, break_start)),
                timezone.make_aware(datetime.combine(date, break_end)),
            )
        )

    available_slots = []
    for slot in all_slots:
        slot_end = slot + service_duration
        is_available = True

        for apt_start, apt_end in existing_appointments:
            apt_end_with_buffer = apt_end + buffer_duration
            if slot < apt_end_with_buffer and slot_end > apt_start:
                is_available = False
                break

        if not is_available:
            continue

        # Check collisions with breaks.
        for break_start, break_end in breaks:
            if slot < break_end and slot_end > break_start:
                is_available = False
                break

        if is_available:
            available_slots.append(slot)

    return available_slots


def calculate_employee_workload(employee, date_from, date_to):
    """
    Oblicza obłożenie pracownika w danym okresie.

    Args:
        employee: Obiekt Employee
        date_from: Data początkowa (datetime.date)
        date_to: Data końcowa (datetime.date)

    Returns:
        dict: {
            'available_hours': float,
            'booked_hours': float,
            'workload_percent': float
        }
    """
    from .models import Schedule, Appointment

    available_minutes = 0
    current_date = date_from

    weekday_map = {
        0: "Monday",
        1: "Tuesday",
        2: "Wednesday",
        3: "Thursday",
        4: "Friday",
        5: "Saturday",
        6: "Sunday",
    }

    schedule = employee.schedules.filter(
        status=Schedule.Status.ACTIVE,
    ).first()

    while current_date <= date_to:
        if schedule:
            day_name = weekday_map[current_date.weekday()]
            for period in schedule.availability_periods:
                if period.get("day") == day_name:
                    try:
                        start = datetime.strptime(period["start"], "%H:%M")
                        end = datetime.strptime(period["end"], "%H:%M")
                        available_minutes += (end - start).total_seconds() // 60

                        for break_item in schedule.breaks:
                            break_start = datetime.strptime(break_item["start"], "%H:%M")
                            break_end = datetime.strptime(break_item["end"], "%H:%M")
                            available_minutes -= (break_end - break_start).total_seconds() // 60
                        break
                    except (ValueError, TypeError, KeyError):
                        break

        current_date += timedelta(days=1)

    booked_appointments = Appointment.objects.filter(
        employee=employee,
        start__date__gte=date_from,
        start__date__lte=date_to,
        status__in=[
            Appointment.Status.CONFIRMED,
            Appointment.Status.IN_PROGRESS,
            Appointment.Status.COMPLETED,
        ],
    )

    booked_minutes = sum(
        (apt.end - apt.start).total_seconds() // 60 for apt in booked_appointments
    )

    available_hours = available_minutes / 60
    booked_hours = booked_minutes / 60
    workload_percent = (booked_hours / available_hours * 100) if available_hours > 0 else 0

    return {
        "available_hours": round(available_hours, 2),
        "booked_hours": round(booked_hours, 2),
        "workload_percent": round(workload_percent, 2),
    }


def get_top_services(limit=5, date_from=None, date_to=None):
    """
    Zwraca najpopularniejsze usługi na podstawie liczby rezerwacji.

    Args:
        limit: Maksymalna liczba wyników (default: 5)
        date_from: Data początkowa filtrowania (opcjonalne)
        date_to: Data końcowa filtrowania (opcjonalne)

    Returns:
        QuerySet: Usługi posortowane według liczby rezerwacji
    """
    from .models import Service, Appointment

    filters = Q(
        appointments__status__in=[
            Appointment.Status.CONFIRMED,
            Appointment.Status.IN_PROGRESS,
            Appointment.Status.COMPLETED,
        ]
    )

    if date_from:
        filters &= Q(appointments__start__date__gte=date_from)
    if date_to:
        filters &= Q(appointments__start__date__lte=date_to)

    return (
        Service.objects.annotate(
            total_bookings=Count("appointments", filter=filters),
        )
        .filter(total_bookings__gt=0)
        .order_by("-total_bookings")[:limit]
    )


def get_cancellation_stats(date_from, date_to):
    """
    Zwraca statystyki anulacji wizyt w danym okresie.

    Args:
        date_from: Data początkowa
        date_to: Data końcowa

    Returns:
        dict: Statystyki anulacji i realizacji wizyt
    """
    from .models import Appointment

    appointments = Appointment.objects.filter(
        start__date__gte=date_from,
        start__date__lte=date_to,
    )

    total = appointments.count()
    cancelled = appointments.filter(status=Appointment.Status.CANCELLED).count()
    no_show = appointments.filter(status=Appointment.Status.NO_SHOW).count()
    completed = appointments.filter(status=Appointment.Status.COMPLETED).count()

    return {
        "total": total,
        "cancelled": cancelled,
        "no_show": no_show,
        "completed": completed,
        "cancelled_percent": round((cancelled / total * 100) if total > 0 else 0, 2),
        "no_show_percent": round((no_show / total * 100) if total > 0 else 0, 2),
        "completion_rate": round((completed / total * 100) if total > 0 else 0, 2),
    }