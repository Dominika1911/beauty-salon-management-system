import pytest
from datetime import timedelta
from django.utils import timezone
from model_bakery import baker


@pytest.mark.unit
@pytest.mark.django_db
class TestUserModel:

    def test_create_admin_user(self, admin_user):
        assert admin_user.role == "ADMIN"
        assert admin_user.is_staff is True
        assert admin_user.is_superuser is True
        assert admin_user.is_active is True

    def test_create_employee_user(self, employee_user):
        assert employee_user.role == "EMPLOYEE"
        assert hasattr(employee_user, "employee_profile")
        assert employee_user.employee_profile.employee_number is not None

    def test_create_client_user(self, client_user):
        assert client_user.role == "CLIENT"
        assert hasattr(client_user, "client_profile")
        assert client_user.client_profile.client_number is not None

    def test_user_str_representation(self, admin_user):
        expected = "admin-00000001 - Administrator"
        assert str(admin_user) == expected

    def test_user_is_admin_property(self, admin_user):
        assert admin_user.is_admin is True

    def test_user_is_employee_property(self, employee_user):
        assert employee_user.is_employee is True

    def test_user_is_client_property(self, client_user):
        assert client_user.is_client is True

@pytest.mark.unit
@pytest.mark.django_db
class TestServiceModel:

    def test_create_service(self, service):
        assert service.name == "Manicure"
        assert str(service.price) == "80.00"
        assert service.duration_minutes == 60
        assert service.is_active is True

    def test_service_str_representation(self, service):
        assert str(service) == "Manicure"

    def test_service_default_active_status(self, db):
        service = baker.make("beauty_salon.Service", name="Test")
        assert service.is_active is True

    def test_inactive_service(self, inactive_service):
        assert inactive_service.is_active is False

    def test_service_duration_property(self, service):
        assert service.duration == timedelta(minutes=60)


@pytest.mark.unit
@pytest.mark.django_db
class TestAppointmentModel:

    def test_create_appointment(self, appointment):
        assert appointment.status == "PENDING"
        assert appointment.client is not None
        assert appointment.employee is not None
        assert appointment.service is not None

    def test_appointment_end_time_calculation(self, appointment):
        expected_end = appointment.start + timedelta(minutes=60)
        assert appointment.end == expected_end

    def test_appointment_status_change(self, appointment):
        appointment.status = "CONFIRMED"
        appointment.save()
        appointment.refresh_from_db()
        assert appointment.status == "CONFIRMED"


@pytest.mark.unit
@pytest.mark.django_db
class TestEmployeeProfileModel:

    def test_employee_number_exists(self, employee_profile):
        assert employee_profile.employee_number is not None
        assert len(employee_profile.employee_number) == 8

    def test_employee_profile_str(self, employee_profile):
        result = str(employee_profile)
        assert employee_profile.employee_number in result

    def test_employee_one_to_one_with_user(self, employee_user):
        assert employee_user.employee_profile.user == employee_user

    def test_employee_get_full_name(self, employee_profile):
        full_name = employee_profile.get_full_name()
        assert isinstance(full_name, str)
        assert "Jan" in full_name
        assert "Kowalski" in full_name

@pytest.mark.unit
@pytest.mark.django_db
class TestClientProfileModel:

    def test_client_number_exists(self, client_profile):
        assert client_profile.client_number is not None
        assert len(client_profile.client_number) == 8

    def test_client_profile_str(self, client_profile):
        result = str(client_profile)
        assert client_profile.client_number in result

    def test_client_one_to_one_with_user(self, client_user):
        assert client_user.client_profile.user == client_user

    def test_client_get_full_name(self, client_profile):
        full_name = client_profile.get_full_name()
        assert isinstance(full_name, str)
        assert "Anna" in full_name
        assert "Nowak" in full_name

@pytest.mark.unit
@pytest.mark.django_db
class TestEmployeeScheduleModel:

    def test_create_schedule(self, employee_schedule):
        assert employee_schedule.weekly_hours is not None
        assert "mon" in employee_schedule.weekly_hours

    def test_schedule_jsonb_structure(self, employee_schedule):
        monday = employee_schedule.weekly_hours.get("mon")
        assert isinstance(monday, list)
        assert len(monday) > 0
        assert "start" in monday[0]
        assert "end" in monday[0]


@pytest.mark.unit
@pytest.mark.django_db
class TestTimeOffModel:

    def test_create_pending_timeoff(self, pending_timeoff):
        assert pending_timeoff.status == "PENDING"
        assert pending_timeoff.decided_by is None

    def test_approve_timeoff(self, pending_timeoff, admin_user):
        pending_timeoff.status = "APPROVED"
        pending_timeoff.decided_by = admin_user
        pending_timeoff.decided_at = timezone.now()
        pending_timeoff.save()

        pending_timeoff.refresh_from_db()
        assert pending_timeoff.status == "APPROVED"
        assert pending_timeoff.decided_by == admin_user
