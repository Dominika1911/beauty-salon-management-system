# salon/managers.py

from django.db import models
from django.db.models import Q, Count, Sum
from django.utils import timezone


# Manager dla Soft Delete
class ActiveManager(models.Manager):
    """Filtruje obiekty, które nie zostały 'miękko' usunięte."""

    # SUGESTIA: Automatycznie używaj tego managera dla relacji
    use_for_related_fields = True

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)

# QuerySet dla Wizyt
class WizytaQuerySet(models.QuerySet):

    def active(self):
        # Importujemy model tutaj, aby uniknąć circular import
        from .models import Wizyta
        return self.filter(status__in=[
            Wizyta.StatusChoices.OCZEKUJACA,
            Wizyta.StatusChoices.POTWIERDZONA,
            Wizyta.StatusChoices.W_TRAKCIE
        ])

    def upcoming(self):
        return self.active().filter(termin_start__gte=timezone.now())

    def past(self):
        return self.filter(termin_start__lt=timezone.now())

    def for_date_range(self, start_date, end_date):
        return self.filter(
            termin_start__date__gte=start_date,
            termin_start__date__lte=end_date
        )

    def revenue_summary(self):
        from .models import Platnosc
        return self.aggregate(
            total_visits=Count('id'),
            total_revenue=Sum('platnosci__kwota', filter=Q(platnosci__status=Platnosc.StatusChoices.ZAPLACONA))
        )


class WizytaManager(models.Manager):
    def get_queryset(self):
        return WizytaQuerySet(self.model, using=self._db)

    def active(self):
        return self.get_queryset().active()

    def upcoming(self):
        return self.get_queryset().upcoming()

    def for_date_range(self, start_date, end_date):
        return self.get_queryset().for_date_range(start_date, end_date)