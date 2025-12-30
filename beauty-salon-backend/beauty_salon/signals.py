import logging
from django.db import transaction
from django.db.models import Max
from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import EmployeeProfile, ClientProfile

logger = logging.getLogger(__name__)


def _get_next_number(model_class, field_name: str, max_retries: int = 3) -> str:
    """
    Funkcja pomocnicza generująca sekwencyjne numery identyfikacyjne.

    Wykorzystuje agregację Max() w celu optymalizacji wydajności bazy danych.
    Zastosowano mechanizm powtórzeń (retry logic) oraz blokowanie rekordów
    (select_for_update) w celu uniknięcia problemów z wyścigiem (race conditions).

    Args:
        model_class: Klasa modelu (EmployeeProfile lub ClientProfile).
        field_name: Nazwa pola identyfikatora.
        max_retries: Maksymalna liczba prób w przypadku wystąpienia konfliktu.

    Returns:
        str: Ośmiocyfrowy numer w formacie tekstowym (np. "00000001").
    """
    for attempt in range(max_retries):
        try:
            with transaction.atomic():
                # Pobranie najwyższego aktualnego numeru z blokadą wierszy
                result = model_class.objects.select_for_update().aggregate(
                    max_num=Max(field_name)
                )

                max_num = result.get("max_num")

                # Walidacja formatu i konwersja na typ całkowity
                if max_num and max_num.isdigit():
                    try:
                        next_number = int(max_num) + 1
                    except (ValueError, TypeError):
                        next_number = 1
                else:
                    next_number = 1

                return f"{next_number:08d}"

        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(
                    f"Próba {attempt + 1}/{max_retries} nieudana dla {field_name}: {e}"
                )
                continue
            else:
                logger.error(
                    f"Błąd generowania numeru {field_name} po {max_retries} próbach: {e}"
                )
                raise ValueError(
                    f"Nie można wygenerować unikalnego numeru {field_name}"
                ) from e

    return "00000001"


@receiver(pre_save, sender=EmployeeProfile)
def generate_employee_number(sender, instance: EmployeeProfile, **kwargs):
    """
    Sygnał automatycznie generujący numer pracownika przed zapisem do bazy danych.
    Działa wyłącznie dla nowych rekordów, które nie posiadają jeszcze identyfikatora.
    """
    if instance.pk or instance.employee_number:
        return

    try:
        instance.employee_number = _get_next_number(EmployeeProfile, "employee_number")
    except ValueError:
        raise


@receiver(pre_save, sender=ClientProfile)
def generate_client_number(sender, instance: ClientProfile, **kwargs):
    """
    Sygnał automatycznie generujący numer klienta przed zapisem do bazy danych.
    Działa wyłącznie dla nowych rekordów, które nie posiadają jeszcze identyfikatora.
    """
    if instance.pk or instance.client_number:
        return

    try:
        instance.client_number = _get_next_number(ClientProfile, "client_number")
    except ValueError:
        raise
