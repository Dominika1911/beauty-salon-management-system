from django.db import transaction
from django.dispatch import receiver
from django.db.models.signals import pre_save, post_save, post_delete
from django.db.models import Sum
from django.utils import timezone

# Importy modeli, potrzebne do użycia w dekoratorach sender=
from .models import User, Employee, Client, Appointment, Payment


@receiver(pre_save, sender=Employee)
def generate_employee_number(sender, instance, **kwargs):
    """Automatycznie generuje numer pracownika (EMP-XXXXXX)."""
    if instance.pk or instance.number:
        return

    from .models import Employee as EmployeeModel

    with transaction.atomic():
        last_employee = (
            EmployeeModel.objects
            .select_for_update()
            .filter(number__regex=r'^EMP-\d{4}')
            .order_by('-number')
            .first()
        )
        next_number = int(last_employee.number.split('-')[1]) + 1 if last_employee else 1
        instance.number = f'EMP-{next_number:04d}'


@receiver(pre_save, sender=Client)
def generate_client_number(sender, instance, **kwargs):
    """Automatycznie generuje numer klienta (CLI-XXXXXX)."""
    if instance.pk or instance.number:
        return

    from .models import Client as ClientModel

    with transaction.atomic():
        last_client = (
            ClientModel.objects
            .select_for_update()
            .filter(number__regex=r'^CLI-\d{4}')
            .order_by('-number')
            .first()
        )
        next_number = int(last_client.number.split('-')[1]) + 1 if last_client else 1
        instance.number = f'CLI-{next_number:04d}'


@receiver(post_save, sender=Appointment)
def update_client_statistics(sender, instance, created, **kwargs):
    """Aktualizuje statystyki klienta po zapisaniu wizyty."""
    from .models import Appointment, Payment

    if instance.status == 'completed' and instance.client:
        client = instance.client
        completed_count = Appointment.objects.filter(client=client, status='completed').count()
        total_spent = (
            Payment.objects.filter(
                appointment__client=client,
                appointment__status='completed',
                status='paid'
            ).aggregate(total=Sum('amount'))['total'] or 0
        )
        client.visits_count = completed_count
        client.total_spent_amount = total_spent
        client.save(update_fields=['visits_count', 'total_spent_amount'])


@receiver(post_save, sender=Appointment)
def update_employee_statistics(sender, instance, created, **kwargs):
    """Aktualizuje statystyki pracownika po zapisaniu wizyty."""
    from .models import Appointment
    if instance.status == 'completed' and instance.employee:
        employee = instance.employee
        completed_count = Appointment.objects.filter(employee=employee, status='completed').count()
        employee.appointments_count = completed_count
        employee.save(update_fields=['appointments_count'])


@receiver(post_save, sender=Payment)
def update_invoice_payment_status(sender, instance, created, **kwargs):
    """Automatycznie aktualizuje status faktury po zapisaniu płatności."""
    from .models import Invoice
    if instance.status == 'paid' and instance.appointment:
        try:
            invoice = Invoice.objects.get(appointment=instance.appointment)
            if not invoice.is_paid:
                invoice.is_paid = True
                invoice.paid_date = instance.paid_at.date() if instance.paid_at else timezone.now().date()
                invoice.save(update_fields=['is_paid', 'paid_date'])
        except Invoice.DoesNotExist:
            pass


@receiver(pre_save, sender=Appointment)
def validate_appointment_time(sender, instance, **kwargs):
    """Walidacja czasu wizyty przed zapisaniem."""
    if instance.start and instance.end and instance.end <= instance.start:
        from django.core.exceptions import ValidationError
        raise ValidationError("Koniec wizyty musi być po jej początku.")


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Automatycznie tworzy profil Employee lub Client po utworzeniu użytkownika."""
    from .models import Employee, Client
    if not created:
        return

    if instance.role == 'employee' and not hasattr(instance, 'employee'):
        Employee.objects.create(
            user=instance,
            first_name='',
            last_name='',
            is_active=True,
        )

    # używamy 'client_profile', bo takie jest related_name w modelu Client
    elif instance.role == 'client' and not hasattr(instance, 'client_profile'):
        Client.objects.create(
            user=instance,
            first_name='',
            last_name='',
            email=instance.email,
        )


@receiver(post_delete, sender=Appointment)
def recalculate_statistics_on_delete(sender, instance, **kwargs):
    """Przelicza statystyki po usunięciu wizyty."""
    from .models import Appointment, Payment
    if instance.client:
        client = instance.client
        completed_count = Appointment.objects.filter(client=client, status='completed').count()
        total_spent = (
            Payment.objects.filter(
                appointment__client=client,
                appointment__status='completed',
                status='paid'
            ).aggregate(total=Sum('amount'))['total'] or 0
        )
        client.visits_count = completed_count
        client.total_spent_amount = total_spent
        client.save(update_fields=['visits_count', 'total_spent_amount'])
    if instance.employee:
        employee = instance.employee
        completed_count = Appointment.objects.filter(employee=employee, status='completed').count()
        employee.appointments_count = completed_count
        employee.save(update_fields=['appointments_count'])
