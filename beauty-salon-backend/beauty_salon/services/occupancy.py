from __future__ import annotations

from datetime import date, datetime, timedelta, time
from decimal import Decimal
from typing import Iterable

from django.utils import timezone

from beauty_salon.models import Employee, Schedule, TimeOff, Appointment


WEEKDAY_MAP = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def _parse_hhmm(s: str) -> time:
    parts = str(s).split(":")
    h = int(parts[0])
    m = int(parts[1])
    sec = int(parts[2]) if len(parts) > 2 else 0
    return time(hour=h, minute=m, second=sec)


def _daterange(d1: date, d2: date) -> Iterable[date]:
    cur = d1
    while cur <= d2:
        yield cur
        cur += timedelta(days=1)


def _clip_interval(s: datetime, e: datetime, win_s: datetime, win_e: datetime):
    s2 = max(s, win_s)
    e2 = min(e, win_e)
    return (s2, e2) if e2 > s2 else None


def _subtract_intervals(
    base: list[tuple[datetime, datetime]],
    cuts: list[tuple[datetime, datetime]],
) -> list[tuple[datetime, datetime]]:
    out: list[tuple[datetime, datetime]] = []
    for bs, be in base:
        cur = [(bs, be)]
        for cs, ce in cuts:
            new_cur = []
            for s, e in cur:
                if ce <= s or cs >= e:
                    new_cur.append((s, e))
                else:
                    if cs > s:
                        new_cur.append((s, cs))
                    if ce < e:
                        new_cur.append((ce, e))
            cur = new_cur
        out.extend(cur)
    return out


def compute_employee_availability_minutes(employee: Employee, since_dt: datetime, to_dt: datetime) -> int:
    """
    Dostępność = availability_periods - breaks - timeoff.
    """
    tz = timezone.get_current_timezone()

    schedule = Schedule.objects.filter(employee=employee, status=Schedule.Status.ACTIVE).first()
    if not schedule:
        return 0

    periods = schedule.availability_periods or []
    breaks_raw = schedule.breaks or []

    timeoffs = list(
        TimeOff.objects.filter(
            employee=employee,
            status=TimeOff.Status.APPROVED,
            date_to__gte=since_dt.date(),
            date_from__lte=to_dt.date(),
        ).only("date_from", "date_to")
    )

    # 1) dostępność z grafiku (po dniach)
    availability_blocks: list[tuple[datetime, datetime]] = []
    for day in _daterange(since_dt.date(), to_dt.date()):
        if any(t.date_from <= day <= t.date_to for t in timeoffs):
            continue

        wd = day.weekday()
        for p in periods:
            if not isinstance(p, dict):
                continue
            if WEEKDAY_MAP.get(str(p.get("weekday", "")).strip().lower()) != wd:
                continue

            try:
                st = _parse_hhmm(p.get("start_time"))
                en = _parse_hhmm(p.get("end_time"))
            except Exception:
                continue
            if en <= st:
                continue

            s = timezone.make_aware(datetime.combine(day, st), tz)
            e = timezone.make_aware(datetime.combine(day, en), tz)

            clipped = _clip_interval(s, e, since_dt, to_dt)
            if clipped:
                availability_blocks.append(clipped)

    if not availability_blocks:
        return 0

    # 2) breaks: datowe + tygodniowe
    break_blocks: list[tuple[datetime, datetime]] = []

    # 2a) datowe: {"start":"ISO", "end":"ISO"}
    for b in breaks_raw if isinstance(breaks_raw, list) else []:
        try:
            if isinstance(b, dict) and "start" in b and "end" in b:
                bs = datetime.fromisoformat(str(b["start"]))
                be = datetime.fromisoformat(str(b["end"]))
                if timezone.is_naive(bs):
                    bs = timezone.make_aware(bs, tz)
                if timezone.is_naive(be):
                    be = timezone.make_aware(be, tz)
                clipped = _clip_interval(bs, be, since_dt, to_dt)
                if clipped:
                    break_blocks.append(clipped)
        except Exception:
            continue

    # 2b) tygodniowe: {"weekday":"monday", "start_time":"HH:MM", "end_time":"HH:MM"}
    for b in breaks_raw if isinstance(breaks_raw, list) else []:
        try:
            if not (isinstance(b, dict) and "weekday" in b and "start_time" in b and "end_time" in b):
                continue
            bwd = WEEKDAY_MAP.get(str(b.get("weekday", "")).strip().lower())
            if bwd is None:
                continue
            bst = _parse_hhmm(b.get("start_time"))
            ben = _parse_hhmm(b.get("end_time"))
            if ben <= bst:
                continue

            for day in _daterange(since_dt.date(), to_dt.date()):
                if day.weekday() != bwd:
                    continue
                bs = timezone.make_aware(datetime.combine(day, bst), tz)
                be = timezone.make_aware(datetime.combine(day, ben), tz)
                clipped = _clip_interval(bs, be, since_dt, to_dt)
                if clipped:
                    break_blocks.append(clipped)
        except Exception:
            continue

    final_blocks = _subtract_intervals(availability_blocks, break_blocks)

    minutes = 0
    for s, e in final_blocks:
        if e > s:
            minutes += int((e - s).total_seconds() // 60)
    return minutes


def compute_employee_appointments_minutes(employee: Employee, since_dt: datetime, to_dt: datetime) -> int:
    """
    Minuty wizyt nachodzących na okno. Pomija CANCELLED/NO_SHOW.
    """
    active_statuses = [
        Appointment.Status.PENDING,
        Appointment.Status.CONFIRMED,
        Appointment.Status.IN_PROGRESS,
        Appointment.Status.COMPLETED,
    ]

    qs = Appointment.objects.filter(
        employee=employee,
        status__in=active_statuses,
        start__lt=to_dt,
        end__gt=since_dt,
    ).only("start", "end")

    total = 0
    for a in qs:
        s = max(a.start, since_dt)
        e = min(a.end, to_dt)
        if e > s:
            total += int((e - s).total_seconds() // 60)
    return total


def compute_weighted_occupancy_percent(since_dt: datetime, to_dt: datetime) -> Decimal:
    """
    Ważone obłożenie salonu: (Σ minut wizyt)/(Σ minut dostępności) * 100
    """
    total_avail = 0
    total_appt = 0
    for e in Employee.objects.filter(is_active=True, deleted_at__isnull=True):
        total_avail += compute_employee_availability_minutes(e, since_dt, to_dt)
        total_appt += compute_employee_appointments_minutes(e, since_dt, to_dt)

    if total_avail <= 0:
        return Decimal("0.00")

    occ = (Decimal(total_appt) / Decimal(total_avail)) * Decimal("100.00")
    return occ.quantize(Decimal("0.01"))
