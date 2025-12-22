from django.db import transaction
from django.dispatch import receiver
from django.db.models.signals import pre_save

from .models import EmployeeProfile, ClientProfile


@receiver(pre_save, sender=EmployeeProfile)
def generate_employee_number(sender, instance: EmployeeProfile, **kwargs):
    """
    Automatycznie generuje employee_number dla nowych pracowników.
    Format: 8 cyfr, np. 00000001, 00000002, ...
    """
    # Jeśli pracownik już istnieje (update), nie zmieniaj numeru
    if instance.pk:
        return

    # Jeśli numer został już ręcznie ustawiony, nie nadpisuj
    if instance.employee_number:
        return

    # Wygeneruj kolejny numer w transakcji atomowej
    with transaction.atomic():
        last_employee = (
            EmployeeProfile.objects
            .select_for_update()
            .filter(employee_number__regex=r'^\d{8}$')
            .order_by('-employee_number')
            .first()
        )

        if last_employee:
            next_number = int(last_employee.employee_number) + 1
        else:
            next_number = 1

        instance.employee_number = f'{next_number:08d}'


@receiver(pre_save, sender=ClientProfile)
def generate_client_number(sender, instance: ClientProfile, **kwargs):
    """
    Automatycznie generuje client_number dla nowych klientów.
    Format: 8 cyfr, np. 00000001, 00000002, ...
    """
    # Jeśli klient już istnieje (update), nie zmieniaj numeru
    if instance.pk:
        return

    # Jeśli numer został już ręcznie ustawiony, nie nadpisuj
    if instance.client_number:
        return

    # Wygeneruj kolejny numer w transakcji atomowej
    with transaction.atomic():
        last_client = (
            ClientProfile.objects
            .select_for_update()
            .filter(client_number__regex=r'^\d{8}$')
            .order_by('-client_number')
            .first()
        )

        if last_client:
            next_number = int(last_client.client_number) + 1
        else:
            next_number = 1

        instance.client_number = f'{next_number:08d}'