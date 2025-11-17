from django.db import models
from django.db.models import Q, Count, Sum
from django.utils import timezone


class ActiveManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class AppointmentQuerySet(models.QuerySet):
    def active(self):
        from .models import Appointment

        # Statusy blokujące grafik: Oczekująca, Potwierdzona, W trakcie
        return self.filter(
            status__in=[
                Appointment.Status.PENDING,
                Appointment.Status.CONFIRMED,
                Appointment.Status.IN_PROGRESS,
            ]
        )

    def upcoming(self):
        return self.active().filter(start__gte=timezone.now())

    def past(self):
        return self.filter(start__lt=timezone.now())

    def for_date_range(self, start_date, end_date):
        return self.filter(
            start__date__gte=start_date,
            start__date__lte=end_date,
        )

    def revenue_summary(self):
        from .models import Payment

        return self.aggregate(
            total_visits=Count("id"),
            total_revenue=Sum(
                "payments__amount",
                filter=Q(payments__status=Payment.Status.PAID),
            ),
        )


class AppointmentManager(models.Manager):

    def get_queryset(self):
        return AppointmentQuerySet(self.model, using=self._db)

    def active(self):
        return self.get_queryset().active()

    def upcoming(self):
        return self.get_queryset().upcoming()

    def for_date_range(self, start_date, end_date):
        return self.get_queryset().for_date_range(start_date, end_date)