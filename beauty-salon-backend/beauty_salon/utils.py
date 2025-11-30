from datetime import datetime, timedelta, time
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Any, Tuple, Optional

from django.core.validators import RegexValidator
from django.db.models import Q, Count, QuerySet
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

phone_validator = RegexValidator(
    r'^\+?[1-9]\d{8,14}$',
    _("Numer telefonu musi być w formacie międzynarodowym (+XXXXXXXXX, 9-15 cyfr)."),
)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_employee_number() -> str:
    """
    Generuje numer pracownika w formacie EMP-XXXX (4 cyfry).
    """
    from .models import Employee

    last_employee = Employee.objects.filter(
        number__startswith='EMP-'
    ).order_by("-number").first()

    if not last_employee:
        return "EMP-0001"

    try:
        # Sprawdź czy number nie jest None
        if last_employee.number is None:
            count = Employee.objects.filter(number__startswith='EMP-').count()
            return f"EMP-{count + 1:04d}"

        last_num = int(last_employee.number.split("-")[1])
        return f"EMP-{last_num + 1:04d}"
    except (IndexError, ValueError, TypeError, AttributeError):
        count = Employee.objects.filter(number__startswith='EMP-').count()
        return f"EMP-{count + 1:04d}"


def generate_client_number() -> str:
    """
    Generuje numer klienta w formacie CLI-XXXX (4 cyfry).
    """
    from .models import Client

    last_client = Client.objects.filter(
        number__startswith='CLI-'
    ).order_by("-number").first()

    if not last_client:
        return "CLI-0001"

    try:
        # Sprawdź czy number nie jest None
        if last_client.number is None:
            count = Client.objects.filter(number__startswith='CLI-').count()
            return f"CLI-{count + 1:04d}"

        last_num = int(last_client.number.split("-")[1])
        return f"CLI-{last_num + 1:04d}"
    except (IndexError, ValueError, TypeError, AttributeError):
        count = Client.objects.filter(number__startswith='CLI-').count()
        return f"CLI-{count + 1:04d}"


def generate_invoice_number(date: Optional[Any] = None) -> str:
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
    except (IndexError, ValueError, TypeError, AttributeError):
        count = Invoice.objects.filter(number__startswith=prefix).count()
        return f"{prefix}{count + 1:04d}"


def calculate_vat(net_amount: Decimal, vat_rate: Decimal) -> Tuple[Decimal, Decimal]:
    """
    Oblicza kwotę VAT i kwotę brutto na podstawie kwoty netto i stawki VAT.
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


def get_available_time_slots(employee: Any, date: Any, service: Any) -> List[datetime]:
    """
    Zwraca listę dostępnych slotów czasowych dla pracownika w danym dniu.
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

    all_slots: List[datetime] = []
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

    breaks: List[Tuple[datetime, datetime]] = []
    for break_item in schedule.breaks:
        try:
            break_start_time = datetime.strptime(break_item["start"], "%H:%M").time()
            break_end_time = datetime.strptime(break_item["end"], "%H:%M").time()
        except (ValueError, TypeError, KeyError):
            continue

        breaks.append(
            (
                timezone.make_aware(datetime.combine(date, break_start_time)),
                timezone.make_aware(datetime.combine(date, break_end_time)),
            )
        )

    available_slots: List[datetime] = []
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

        for break_start, break_end in breaks:
            if slot < break_end and slot_end > break_start:
                is_available = False
                break

        if is_available:
            available_slots.append(slot)

    return available_slots


def calculate_employee_workload(employee: Any, date_from: Any, date_to: Any) -> Dict[str, float]:
    """
    Oblicza obłożenie pracownika w danym okresie.
    """
    from .models import Schedule, Appointment

    available_minutes = 0.0
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

    schedule = employee.schedule
    if not schedule:
        return {
            "available_hours": 0.0,
            "booked_hours": 0.0,
            "workload_percent": 0.0,
        }

    while current_date <= date_to:
        day_name = weekday_map[current_date.weekday()]

        if schedule.status == Schedule.Status.ACTIVE:
            for period in schedule.availability_periods:
                if period.get("day") == day_name:
                    try:
                        start = datetime.strptime(period["start"], "%H:%M")
                        end = datetime.strptime(period["end"], "%H:%M")
                        available_minutes += (end - start).total_seconds() / 60

                        for break_item in schedule.breaks:
                            break_start = datetime.strptime(break_item["start"], "%H:%M")
                            break_end = datetime.strptime(break_item["end"], "%H:%M")
                            available_minutes -= (break_end - break_start).total_seconds() / 60
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
        (apt.end - apt.start).total_seconds() / 60 for apt in booked_appointments
    )

    available_hours = available_minutes / 60
    booked_hours = booked_minutes / 60
    workload_percent = (booked_hours / available_hours * 100) if available_hours > 0 else 0.0

    return {
        "available_hours": round(available_hours, 2),
        "booked_hours": round(booked_hours, 2),
        "workload_percent": round(workload_percent, 2),
    }


def get_top_services(limit: int = 5, date_from: Optional[Any] = None, date_to: Optional[Any] = None) -> QuerySet:
    """
    Zwraca najpopularniejsze usługi na podstawie liczby rezerwacji.
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


def get_cancellation_stats(date_from: Any, date_to: Any) -> Dict[str, Any]:
    """
    Zwraca statystyki anulacji wizyt w danym okresie.
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