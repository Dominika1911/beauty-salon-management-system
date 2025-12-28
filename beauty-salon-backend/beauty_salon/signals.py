from django.db import transaction, IntegrityError
from django.db.models import Max
from django.dispatch import receiver
from django.db.models.signals import pre_save

from .models import EmployeeProfile, ClientProfile


@receiver(pre_save, sender=EmployeeProfile)
def generate_employee_number(sender, instance: EmployeeProfile, **kwargs):
    """
    Automatycznie generuje employee_number dla nowych pracowników.
    Format: 8 cyfr, np. 00000001, 00000002, ...

    ZABEZPIECZENIE: Retry w przypadku race condition.
    """
    # Jeśli pracownik już istnieje (update), nie zmieniaj numeru
    if instance.pk:
        return

    # Jeśli numer został już ręcznie ustawiony, nie nadpisuj
    if instance.employee_number:
        return

    # Wygeneruj kolejny numer z retry mechanizmem
    for attempt in range(5):  # Max 5 prób
        with transaction.atomic():
            # Użyj Max() aggregation
            result = EmployeeProfile.objects.aggregate(max_num=Max('employee_number'))
            last_number = result['max_num']

            if last_number and last_number.isdigit():
                next_number = int(last_number) + 1
            else:
                next_number = 1

            candidate = f'{next_number:08d}'

            # Sprawdź czy numer już nie istnieje (race condition protection)
            if not EmployeeProfile.objects.filter(employee_number=candidate).exists():
                instance.employee_number = candidate
                return

            # Jeśli istnieje, spróbuj ponownie z wyższym numerem
            continue

    # Jeśli po 5 próbach nie udało się, użyj timestamp jako fallback
    import time
    timestamp_suffix = str(int(time.time() * 1000))[-8:]
    instance.employee_number = timestamp_suffix


@receiver(pre_save, sender=ClientProfile)
def generate_client_number(sender, instance: ClientProfile, **kwargs):
    """
    Automatycznie generuje client_number dla nowych klientów.
    Format: 8 cyfr, np. 00000001, 00000002, ...

    ZABEZPIECZENIE: Retry w przypadku race condition.
    """
    # Jeśli klient już istnieje (update), nie zmieniaj numeru
    if instance.pk:
        return

    # Jeśli numer został już ręcznie ustawiony, nie nadpisuj
    if instance.client_number:
        return

    # Wygeneruj kolejny numer z retry mechanizmem
    for attempt in range(5):  # Max 5 prób
        with transaction.atomic():
            # Użyj Max() aggregation
            result = ClientProfile.objects.aggregate(max_num=Max('client_number'))
            last_number = result['max_num']

            if last_number and last_number.isdigit():
                next_number = int(last_number) + 1
            else:
                next_number = 1

            candidate = f'{next_number:08d}'

            # Sprawdź czy numer już nie istnieje (race condition protection)
            if not ClientProfile.objects.filter(client_number=candidate).exists():
                instance.client_number = candidate
                return

            # Jeśli istnieje, spróbuj ponownie z wyższym numerem
            continue

    # Jeśli po 5 próbach nie udało się, użyj timestamp jako fallback
    import time
    timestamp_suffix = str(int(time.time() * 1000))[-8:]
    instance.client_number = timestamp_suffix