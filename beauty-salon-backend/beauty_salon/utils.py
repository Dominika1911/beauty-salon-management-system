# salon/utils.py

from decimal import Decimal
from datetime import timedelta, datetime
from django.db.models import Q, Count
from django.utils import timezone
from decimal import InvalidOperation
from django.core.validators import RegexValidator
from django.utils.translation import gettext_lazy as _

# SUGESTIA 3: Walidator
phone_validator = RegexValidator(
    r'^\+?1?\d{9,15}$',
    _("Numer telefonu musi być w formacie: '+999999999'. Do 15 cyfr.")
)


# ============================================================================
# HELPER FUNCTIONS
# (Importują modele wewnątrz, aby uniknąć cyklicznych zależności)
# ============================================================================

def generate_employee_number():
    from .models import Pracownik
    last_emp = Pracownik.objects.order_by('-nr').first()
    if not last_emp: return 'EMP-0001'
    try:
        last_num = int(last_emp.nr.split('-')[1])
        return f'EMP-{last_num + 1:04d}'
    except (IndexError, ValueError, TypeError):
        count = Pracownik.objects.count()
        return f'EMP-{count + 1:04d}'


def generate_client_number():
    from .models import Klient
    # Używamy .objects (a nie .active) aby policzyć też usuniętych i uniknąć kolizji
    last_cli = Klient.objects.order_by('-nr').first()
    if not last_cli: return 'CLI-0001'
    try:
        last_num = int(last_cli.nr.split('-')[1])
        return f'CLI-{last_num + 1:04d}'
    except (IndexError, ValueError, TypeError):
        count = Klient.objects.count()
        return f'CLI-{count + 1:04d}'


def generate_invoice_number(date=None):
    from .models import Faktura
    if date is None: date = timezone.now().date()
    year, month = date.year, date.month
    prefix = f'FV/{year}/{month:02d}/'
    last_invoice = Faktura.objects.filter(numer__startswith=prefix).order_by('-numer').first()
    if not last_invoice: return f'{prefix}0001'
    try:
        last_num = int(last_invoice.numer.split('/')[-1])
        return f'{prefix}{last_num + 1:04d}'
    except (IndexError, ValueError, TypeError):
        count = Faktura.objects.filter(numer__startswith=prefix).count()
        return f'{prefix}{count + 1:04d}'


def calculate_vat(kwota_netto, stawka_vat):
    try:
        kwota_netto = Decimal(str(kwota_netto))
        stawka_vat = Decimal(str(stawka_vat))
    except (ValueError, InvalidOperation, TypeError):
        raise ValueError("Nieprawidłowe dane wejściowe dla obliczeń VAT.")
    if kwota_netto < 0: raise ValueError("Kwota nie może być ujemna.")
    if not (Decimal('0.00') <= stawka_vat <= Decimal('100.00')):
        raise ValueError("Stawka VAT musi być w zakresie 0-100%.")
    vat_amount = (kwota_netto * stawka_vat / Decimal('100')).quantize(Decimal('0.01'))
    gross_amount = kwota_netto + vat_amount
    return vat_amount, gross_amount


def get_available_time_slots(pracownik, data, usluga):
    from .models import UstawieniaSystemowe, Grafik, Wizyta
    settings = UstawieniaSystemowe.load()  # Używamy nowej metody .load()

    grafik = Grafik.objects.filter(pracownik=pracownik, status=Grafik.StatusChoices.AKTYWNY).first()
    if not grafik or not grafik.is_available_on_date(data): return []

    weekday_map = {0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 4: 'Friday', 5: 'Saturday', 6: 'Sunday'}
    day_name = weekday_map[data.weekday()]
    day_schedule = next((okres for okres in grafik.okresy_dostepnosci if okres.get('day') == day_name), None)
    if not day_schedule: return []

    try:
        start_time = datetime.strptime(day_schedule['start'], '%H:%M').time()
        end_time = datetime.strptime(day_schedule['end'], '%H:%M').time()
    except (ValueError, TypeError):
        return []

    work_start = timezone.make_aware(datetime.combine(data, start_time))
    work_end = timezone.make_aware(datetime.combine(data, end_time))

    slot_duration = timedelta(minutes=settings.slot_minuty)
    buffer_duration = timedelta(minutes=settings.bufor_minuty)
    service_duration = usluga.czas_trwania

    all_slots = []
    current_slot = work_start
    while current_slot + service_duration <= work_end:
        all_slots.append(current_slot)
        current_slot += slot_duration

    existing_appointments = Wizyta.objects.filter(
        pracownik=pracownik, termin_start__date=data,
        status__in=[Wizyta.StatusChoices.OCZEKUJACA, Wizyta.StatusChoices.POTWIERDZONA, Wizyta.StatusChoices.W_TRAKCIE]
    ).values_list('termin_start', 'termin_koniec')

    breaks = []
    for przerwa in grafik.przerwy:
        try:
            break_start = datetime.strptime(przerwa['start'], '%H:%M').time()
            break_end = datetime.strptime(przerwa['end'], '%H:%M').time()
            breaks.append((timezone.make_aware(datetime.combine(data, break_start)),
                           timezone.make_aware(datetime.combine(data, break_end))))
        except (ValueError, TypeError):
            continue

    available_slots = []
    for slot in all_slots:
        slot_end = slot + service_duration
        is_available = True
        for apt_start, apt_end in existing_appointments:
            apt_end_with_buffer = apt_end + buffer_duration
            if slot < apt_end_with_buffer and slot_end > apt_start:
                is_available = False
                break
        if not is_available: continue
        for break_start, break_end in breaks:
            if slot < break_end and slot_end > break_start:
                is_available = False
                break
        if is_available: available_slots.append(slot)
    return available_slots


def calculate_employee_workload(pracownik, data_od, data_do):
    from .models import Grafik, Wizyta
    available_minutes = 0
    current_date = data_od
    weekday_map = {0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 4: 'Friday', 5: 'Saturday', 6: 'Sunday'}
    grafik = pracownik.grafiki.filter(status=Grafik.StatusChoices.AKTYWNY).first()

    while current_date <= data_do:
        if grafik and grafik.is_available_on_date(current_date):
            day_name = weekday_map[current_date.weekday()]
            for okres in grafik.okresy_dostepnosci:
                if okres.get('day') == day_name:
                    try:
                        start = datetime.strptime(okres['start'], '%H:%M')
                        end = datetime.strptime(okres['end'], '%H:%M')
                        available_minutes += (end - start).total_seconds() // 60
                        for przerwa in grafik.przerwy:
                            break_start = datetime.strptime(przerwa['start'], '%H:%M')
                            break_end = datetime.strptime(przerwa['end'], '%H:%M')
                            available_minutes -= (break_end - break_start).total_seconds() // 60
                        break
                    except (ValueError, TypeError):
                        break
        current_date += timedelta(days=1)

    booked_appointments = Wizyta.objects.filter(
        pracownik=pracownik,
        termin_start__date__gte=data_od,
        termin_start__date__lte=data_do,
        status__in=[
            Wizyta.StatusChoices.POTWIERDZONA,
            Wizyta.StatusChoices.W_TRAKCIE,
            Wizyta.StatusChoices.ZREALIZOWANA
        ]
    )
    booked_minutes = sum((apt.termin_koniec - apt.termin_start).total_seconds() // 60 for apt in booked_appointments)
    available_hours = available_minutes / 60
    booked_hours = booked_minutes / 60
    workload_percent = (booked_hours / available_hours * 100) if available_hours > 0 else 0
    return {
        'available_hours': round(available_hours, 2),
        'booked_hours': round(booked_hours, 2),
        'workload_percent': round(workload_percent, 2)
    }


def get_top_services(limit=5, data_od=None, data_do=None):
    from .models import Usluga, Wizyta
    filters = Q(status__in=[
        Wizyta.StatusChoices.POTWIERDZONA,
        Wizyta.StatusChoices.W_TRAKCIE,
        Wizyta.StatusChoices.ZREALIZOWANA
    ])
    if data_od: filters &= Q(termin_start__date__gte=data_od)
    if data_do: filters &= Q(termin_start__date__lte=data_do)
    return Usluga.objects.annotate(
        total_bookings=Count('wizyty', filter=filters)
    ).filter(total_bookings__gt=0).order_by('-total_bookings')[:limit]


def get_cancellation_stats(data_od, data_do):
    from .models import Wizyta
    wizyty = Wizyta.objects.filter(
        termin_start__date__gte=data_od,
        termin_start__date__lte=data_do
    )
    total = wizyty.count()
    cancelled = wizyty.filter(status=Wizyta.StatusChoices.ODWOLANA).count()
    no_show = wizyty.filter(status=Wizyta.StatusChoices.NO_SHOW).count()
    completed = wizyty.filter(status=Wizyta.StatusChoices.ZREALIZOWANA).count()
    return {
        'total': total,
        'cancelled': cancelled,
        'no_show': no_show,
        'completed': completed,
        'cancelled_percent': round((cancelled / total * 100) if total > 0 else 0, 2),
        'no_show_percent': round((no_show / total * 100) if total > 0 else 0, 2),
        'completion_rate': round((completed / total * 100) if total > 0 else 0, 2)
    }