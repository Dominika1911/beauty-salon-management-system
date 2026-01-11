import pytest
from model_bakery import baker
from django.contrib.auth import get_user_model
from django.utils import timezone  # FIXED: Use timezone-aware datetime
from rest_framework.test import APIClient
from datetime import timedelta

User = get_user_model()


@pytest.fixture
def admin_user(db):
    user = baker.make(
        User,
        username='admin-00000001',
        email='admin@test.com',
        role='ADMIN',
        is_active=True,
        is_staff=True,
        is_superuser=True
    )
    user.set_password('testpass123')
    user.save()
    return user


@pytest.fixture
def employee_user(db):
    user = baker.make(
        User,
        username='jan.kowalski',
        email='employee@test.com',
        role='EMPLOYEE',
        is_active=True
    )
    user.set_password('testpass123')
    user.save()

    from beauty_salon.models import EmployeeProfile
    profile = EmployeeProfile.objects.create(
        user=user,
        first_name='Jan',
        last_name='Kowalski',
        employee_number='00000001'
    )
    return user


@pytest.fixture
def client_user(db):
    user = baker.make(
        User,
        username='klient-00000001',
        email='client@test.com',
        role='CLIENT',
        is_active=True
    )
    user.set_password('testpass123')
    user.save()

    from beauty_salon.models import ClientProfile
    profile = ClientProfile.objects.create(
        user=user,
        first_name='Anna',
        last_name='Nowak',
        client_number='00000001'
    )
    return user

@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_api_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def employee_api_client(employee_user):
    client = APIClient()
    client.force_authenticate(user=employee_user)
    return client


@pytest.fixture
def client_api_client(client_user):
    client = APIClient()
    client.force_authenticate(user=client_user)
    return client

@pytest.fixture
def employee_profile(employee_user, service):
    profile = employee_user.employee_profile
    profile.skills.add(service)
    return profile



@pytest.fixture
def client_profile(client_user):
    return client_user.client_profile


@pytest.fixture
def service(db):
    return baker.make(
        'beauty_salon.Service',
        name='Manicure',
        category='Paznokcie',
        description='Klasyczny manicure',
        price='80.00',
        duration_minutes=60,
        is_active=True
    )


@pytest.fixture
def inactive_service(db):
    return baker.make(
        'beauty_salon.Service',
        name='Stara Usługa',
        category='Włosy',
        price='50.00',
        duration_minutes=30,
        is_active=False
    )


@pytest.fixture
def services_list(db):
    return baker.make(
        'beauty_salon.Service',
        is_active=True,
        _quantity=5
    )

@pytest.fixture
def appointment(db, client_profile, employee_profile, service):
    start = timezone.now() + timedelta(days=1, hours=10)  # FIXED: timezone-aware
    return baker.make(
        'beauty_salon.Appointment',
        client=client_profile,
        employee=employee_profile,
        service=service,
        start=start,
        end=start + timedelta(minutes=service.duration_minutes),
        status='PENDING'
    )


@pytest.fixture
def confirmed_appointment(db, client_profile, employee_profile, service):
    start = timezone.now() + timedelta(days=2, hours=14)  # FIXED: timezone-aware
    return baker.make(
        'beauty_salon.Appointment',
        client=client_profile,
        employee=employee_profile,
        service=service,
        start=start,
        end=start + timedelta(minutes=service.duration_minutes),
        status='CONFIRMED'
    )

@pytest.fixture
def employee_schedule(employee_profile):
    return baker.make(
        'beauty_salon.EmployeeSchedule',
        employee=employee_profile,
        weekly_hours={
            "mon": [{"start": "09:00", "end": "17:00"}],
            "tue": [{"start": "09:00", "end": "17:00"}],
            "wed": [{"start": "09:00", "end": "17:00"}],
            "thu": [{"start": "09:00", "end": "17:00"}],
            "fri": [{"start": "09:00", "end": "17:00"}],
            "sat": [],
            "sun": [],
        }
    )

@pytest.fixture
def pending_timeoff(employee_profile):
    return baker.make(
        'beauty_salon.TimeOff',
        employee=employee_profile,
        date_from='2025-02-01',
        date_to='2025-02-05',
        reason='Urlop wypoczynkowy',
        status='PENDING'
    )


@pytest.fixture
def approved_timeoff(employee_profile, admin_user):
    return baker.make(
        'beauty_salon.TimeOff',
        employee=employee_profile,
        date_from='2025-03-01',
        date_to='2025-03-05',
        reason='Urlop wypoczynkowy',
        status='APPROVED',
        decided_by=admin_user,
        decided_at=timezone.now()
    )

@pytest.fixture
def system_settings(db, admin_user):
    return baker.make(
        'beauty_salon.SystemSettings',
        salon_name='Beauty Salon Test',
        slot_minutes=15,
        buffer_minutes=5,
        opening_hours={
            "mon": {"from": "09:00", "to": "20:00"},
            "tue": {"from": "09:00", "to": "20:00"},
            "wed": {"from": "09:00", "to": "20:00"},
            "thu": {"from": "09:00", "to": "20:00"},
            "fri": {"from": "09:00", "to": "20:00"},
            "sat": {"from": "10:00", "to": "18:00"},
            "sun": {},
        },
    updated_by=admin_user
    )

@pytest.fixture
def create_services(db):
    def _create(count=5, **kwargs):
        return baker.make('beauty_salon.Service', _quantity=count, **kwargs)
    return _create


@pytest.fixture
def create_appointments(db, client_profile, employee_profile, service):
    def _create(count=5, **kwargs):
        appointments = []
        for i in range(count):
            start = timezone.now() + timedelta(days=i+1, hours=10)
            app = baker.make(
                'beauty_salon.Appointment',
                client=client_profile,
                employee=employee_profile,
                service=service,
                start=start,
                end=start + timedelta(minutes=60),
                **kwargs
            )
            appointments.append(app)
        return appointments
    return _create


@pytest.fixture
def create_employees(db):
    def _create(count=3):
        from beauty_salon.models import EmployeeProfile
        employees = []
        for i in range(count):
            user = baker.make(
                User,
                username=f'pracownik-0000000{i}',
                email=f'employee{i}@test.com',
                role='EMPLOYEE',
                is_active=True
            )
            profile = EmployeeProfile.objects.create(
                user=user,
                first_name=f'Employee{i}',
                last_name='Test',
                employee_number=f'0000000{i+2}'
            )
            employees.append(profile)
        return employees
    return _create
