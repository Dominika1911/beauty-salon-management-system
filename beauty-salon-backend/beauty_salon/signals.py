from django.db import transaction
from django.dispatch import receiver
from django.db.models.signals import pre_save, post_save, post_delete
from django.db.models import Sum
from django.utils import timezone

from .models import User, Employee, Client, Appointment, Payment, Invoice


@receiver(pre_save, sender=Employee)
def generate_employee_number(sender, instance: Employee, **kwargs):
    """Automatycznie generuje numer pracownika (EMP-XXXXXX)."""
    if instance.pk:
        return

    if instance.number:
        return

    with transaction.atomic():
        last_employee = (
            Employee.objects
            .select_for_update()
            .filter(number__regex=r'^EMP-\d{4}')
            .order_by('-number')
            .first()
        )

        if last_employee:
            last_number = int(last_employee.number.split('-')[1])
            next_number = last_number + 1
        else:
            next_number = 1

        instance.number = f'EMP-{next_number:04d}'


@receiver(pre_save, sender=Client)
def generate_client_number(sender, instance: Client, **kwargs):
    """Automatycznie generuje numer klienta (CLI-XXXXXX)."""
    if instance.pk:
        return

    if instance.number:
        return

    with transaction.atomic():
        last_client = (
            Client.objects
            .select_for_update()
            .filter(number__regex=r'^CLI-\d{4}')
            .order_by('-number')
            .first()
        )

        if last_client:
            last_number = int(last_client.number.split('-')[1])
            next_number = last_number + 1
        else:
            next_number = 1

        instance.number = f'CLI-{next_number:04d}'


@receiver(post_save, sender=Appointment)
def update_client_statistics(sender, instance: Appointment, created, **kwargs):
    """
    Aktualizuje statystyki klienta po zapisaniu wizyty.
    Zwiększa licznik wizyt i sumę wydatków dla zakończonych wizyt.
    """
    if instance.status == 'completed' and instance.client:
        client = instance.client

        # Przelicz wizyty
        completed_count = Appointment.objects.filter(
            client=client,
            status='completed'
        ).count()

        # Przelicz sumę wydatków
        total_spent = Payment.objects.filter(
            appointment__client=client,
            appointment__status='completed',
            status='paid'
        ).aggregate(
            total=Sum('amount')
        )['total'] or 0

        client.visits_count = completed_count
        client.total_spent_amount = total_spent
        client.save(update_fields=['visits_count', 'total_spent_amount'])


@receiver(post_save, sender=Appointment)
def update_employee_statistics(sender, instance: Appointment, created, **kwargs):
    """
    Aktualizuje statystyki pracownika po zapisaniu wizyty.
    Zwiększa licznik wizyt dla zakończonych wizyt.
    """
    if instance.status == 'completed' and instance.employee:
        employee = instance.employee

        # Przelicz wizyty
        completed_count = Appointment.objects.filter(
            employee=employee,
            status='completed'
        ).count()

        employee.appointments_count = completed_count
        employee.save(update_fields=['appointments_count'])


@receiver(post_save, sender=Payment)
def update_invoice_payment_status(sender, instance: Payment, created, **kwargs):
    """
    Automatycznie aktualizuje status faktury po zapisaniu płatności.
    Jeśli płatność jest opłacona i powiązana z fakturą, faktura jest oznaczana jako opłacona.
    """
    if instance.status == 'paid' and instance.appointment:
        # Znajdź fakturę powiązaną z tą wizytą
        try:
            invoice = Invoice.objects.get(appointment=instance.appointment)
            if not invoice.is_paid:
                invoice.is_paid = True
                invoice.paid_date = instance.paid_at.date() if instance.paid_at else timezone.now().date()
                invoice.save(update_fields=['is_paid', 'paid_date'])
        except Invoice.DoesNotExist:
            pass


@receiver(pre_save, sender=Appointment)
def validate_appointment_time(sender, instance: Appointment, **kwargs):
    """
    Walidacja czasu wizyty przed zapisaniem.
    Sprawdza czy koniec wizyty jest po początku.
    """
    if instance.start and instance.end:
        if instance.end <= instance.start:
            from django.core.exceptions import ValidationError
            raise ValidationError("Koniec wizyty musi być po jej początku.")


@receiver(post_save, sender=User)
def create_user_profile(sender, instance: User, created, **kwargs):
    """
    Automatycznie tworzy profil Employee lub Client po utworzeniu użytkownika,
    w zależności od jego roli.
    """
    if not created:
        return

    # Twórz profil Employee dla pracowników
    if instance.role == 'employee' and not hasattr(instance, 'employee'):
        Employee.objects.create(
            user=instance,
            first_name='',
            last_name='',
            is_active=True
        )

    # Twórz profil Client dla klientów
    elif instance.role == 'client' and not hasattr(instance, 'client'):
        Client.objects.create(
            user=instance,
            first_name='',
            last_name='',
            email=instance.email
        )


@receiver(post_delete, sender=Appointment)
def recalculate_statistics_on_delete(sender, instance: Appointment, **kwargs):
    """
    Przelicza statystyki po usunięciu wizyty.
    """
    # Aktualizuj statystyki klienta
    if instance.client:
        client = instance.client
        completed_count = Appointment.objects.filter(
            client=client,
            status='completed'
        ).count()

        total_spent = Payment.objects.filter(
            appointment__client=client,
            appointment__status='completed',
            status='paid'
        ).aggregate(
            total=Sum('amount')
        )['total'] or 0

        client.visits_count = completed_count
        client.total_spent_amount = total_spent
        client.save(update_fields=['visits_count', 'total_spent_amount'])

    # Aktualizuj statystyki pracownika
    if instance.employee:
        employee = instance.employee
        completed_count = Appointment.objects.filter(
            employee=employee,
            status='completed'
        ).count()

        employee.appointments_count = completed_count
        employee.save(update_fields=['appointments_count'])