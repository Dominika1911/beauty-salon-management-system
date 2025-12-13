from __future__ import annotations

from django.core.management.base import BaseCommand
from django.utils import timezone

from beauty_salon.models import StatsSnapshot
from beauty_salon.services.stats_snapshots import resolve_range, generate_stats_snapshot


class Command(BaseCommand):
    help = "Generate StatsSnapshot for selected period(s)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--period",
            choices=[
                StatsSnapshot.Period.DAILY,
                StatsSnapshot.Period.WEEKLY,
                StatsSnapshot.Period.MONTHLY,
                StatsSnapshot.Period.ANNUAL,
                "all",
            ],
            default="all",
            help="Which period snapshot to generate",
        )

    def handle(self, *args, **options):
        period = options["period"]

        periods = (
            [
                StatsSnapshot.Period.DAILY,
                StatsSnapshot.Period.WEEKLY,
                StatsSnapshot.Period.MONTHLY,
                StatsSnapshot.Period.ANNUAL,
            ]
            if period == "all"
            else [period]
        )

        now = timezone.now()
        for p in periods:
            since_dt, to_dt = resolve_range(p, ref=now)
            obj = generate_stats_snapshot(period=p, since_dt=since_dt, to_dt=to_dt)
            self.stdout.write(self.style.SUCCESS(
                f"OK: {p} snapshot {obj.date_from}..{obj.date_to} id={obj.id}"
            ))
