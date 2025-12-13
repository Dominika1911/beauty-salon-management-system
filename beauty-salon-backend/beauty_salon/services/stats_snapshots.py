from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Sum, Q
from django.utils import timezone

from beauty_salon.models import StatsSnapshot, Appointment, Payment, Client
from beauty_salon.services.occupancy import compute_weighted_occupancy_percent


def resolve_range(period: str, ref: datetime | None = None) -> tuple[datetime, datetime]:
    """
    period: daily | weekly | monthly | annual (tak jak w StatsSnapshot.Period) :contentReference[oaicite:3]{index=3}
    """
    now = ref or timezone.now()
    tz = timezone.get_current_timezone()

    if period == StatsSnapshot.Period.DAILY:
        d = now.date()
        since = timezone.make_aware(datetime.combine(d, datetime.min.time()), tz)
        to = since + timedelta(days=1)
        return since, to

    if period == StatsSnapshot.Period.WEEKLY:
        d = now.date()
        start = d - timedelta(days=d.weekday())  # poniedziałek
        since = timezone.make_aware(datetime.combine(start, datetime.min.time()), tz)
        to = since + timedelta(days=7)
        return since, to

    if period == StatsSnapshot.Period.MONTHLY:
        d = now.date()
        start = d.replace(day=1)
        since = timezone.make_aware(datetime.combine(start, datetime.min.time()), tz)
        if start.month == 12:
            next_month = start.replace(year=start.year + 1, month=1, day=1)
        else:
            next_month = start.replace(month=start.month + 1, day=1)
        to = timezone.make_aware(datetime.combine(next_month, datetime.min.time()), tz)
        return since, to

    if period == StatsSnapshot.Period.ANNUAL:
        d = now.date()
        start = d.replace(month=1, day=1)
        since = timezone.make_aware(datetime.combine(start, datetime.min.time()), tz)
        next_year = start.replace(year=start.year + 1, month=1, day=1)
        to = timezone.make_aware(datetime.combine(next_year, datetime.min.time()), tz)
        return since, to

    raise ValueError("Unsupported period")


def generate_stats_snapshot(*, period: str, since_dt: datetime, to_dt: datetime) -> StatsSnapshot:
    """
    Tworzy/aktualizuje snapshot dla (period, date_from, date_to).
    """

    appt_qs = Appointment.objects.filter(start__lt=to_dt, end__gt=since_dt)

    total_visits = appt_qs.count()
    completed_visits = appt_qs.filter(status=Appointment.Status.COMPLETED).count()
    cancellations = appt_qs.filter(status=Appointment.Status.CANCELLED).count()
    no_shows = appt_qs.filter(status=Appointment.Status.NO_SHOW).count()

    revenue_total = (
        Payment.objects.filter(
            status__in=[Payment.Status.PAID, Payment.Status.DEPOSIT],
            created_at__gte=since_dt,
            created_at__lt=to_dt,
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    )

    revenue_deposits = (
        Payment.objects.filter(
            created_at__gte=since_dt,
            created_at__lt=to_dt,
        ).filter(
            Q(status=Payment.Status.DEPOSIT) | Q(type=Payment.Type.DEPOSIT)
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    )

    new_clients = Client.objects.filter(created_at__gte=since_dt, created_at__lt=to_dt, deleted_at__isnull=True).count()

    # klienci, którzy mieli wizytę w oknie, ale NIE są nowi w tym oknie
    returning_clients = Client.objects.filter(
        deleted_at__isnull=True,
        appointments__start__lt=to_dt,
        appointments__end__gt=since_dt,
    ).exclude(created_at__gte=since_dt, created_at__lt=to_dt).distinct().count()

    employees_occupancy_avg = compute_weighted_occupancy_percent(since_dt, to_dt)

    obj, _created = StatsSnapshot.objects.update_or_create(
        period=period,
        date_from=since_dt.date(),
        date_to=to_dt.date(),
        defaults={
            "total_visits": total_visits,
            "completed_visits": completed_visits,
            "cancellations": cancellations,
            "no_shows": no_shows,
            "revenue_total": revenue_total,
            "revenue_deposits": revenue_deposits,
            "new_clients": new_clients,
            "returning_clients": returning_clients,
            "employees_occupancy_avg": employees_occupancy_avg,
        },
    )
    return obj
