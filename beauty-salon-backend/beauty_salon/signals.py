from django.db import transaction
from django.db.models.signals import pre_save
from django.dispatch import receiver

from .models import EmployeeProfile, ClientProfile


@receiver(pre_save, sender=EmployeeProfile)
def generate_employee_number(sender, instance: EmployeeProfile, **kwargs):
    if instance.pk or instance.employee_number:
        return

    with transaction.atomic():
        last_emp = (
            EmployeeProfile.objects
            .select_for_update()
            .filter(employee_number__regex=r"^\d{8}$")
            .order_by("-employee_number")
            .first()
        )

        next_number = int(last_emp.employee_number) + 1 if last_emp else 1
        instance.employee_number = f"{next_number:08d}"


@receiver(pre_save, sender=ClientProfile)
def generate_client_number(sender, instance: ClientProfile, **kwargs):
    if instance.pk or instance.client_number:
        return

    with transaction.atomic():
        last_client = (
            ClientProfile.objects
            .select_for_update()
            .filter(client_number__regex=r"^\d{8}$")
            .order_by("-client_number")
            .first()
        )

        next_number = int(last_client.client_number) + 1 if last_client else 1
        instance.client_number = f"{next_number:08d}"
