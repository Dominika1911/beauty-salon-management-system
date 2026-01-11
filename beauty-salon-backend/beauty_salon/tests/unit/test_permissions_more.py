import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIRequestFactory
from model_bakery import baker


@pytest.mark.unit
@pytest.mark.django_db
class TestMorePermissionBranches:

    def test_can_modify_appointment_admin_true(self, admin_user, appointment):
        from beauty_salon.permissions import CanModifyAppointment

        req = APIRequestFactory().patch("/fake")
        req.user = admin_user

        perm = CanModifyAppointment()
        assert perm.has_object_permission(req, None, appointment) is True

    def test_can_modify_appointment_client_false(self, client_user, appointment):
        from beauty_salon.permissions import CanModifyAppointment

        req = APIRequestFactory().patch("/fake")
        req.user = client_user

        perm = CanModifyAppointment()
        assert perm.has_object_permission(req, None, appointment) is False

    def test_can_cancel_appointment_employee_only_own(self, employee_user, employee_profile, client_profile, service, create_employees):
        from beauty_salon.permissions import CanCancelAppointment

        other_employee = create_employees(count=1)[0]

        appt = baker.make(
            "beauty_salon.Appointment",
            client=client_profile,
            employee=other_employee,
            service=service,
            start=timezone.now() + timedelta(days=2),
            end=timezone.now() + timedelta(days=2, minutes=60),
            status="CONFIRMED",
        )

        req = APIRequestFactory().delete("/fake")
        req.user = employee_user

        perm = CanCancelAppointment()
        assert perm.has_object_permission(req, None, appt) is False

    def test_can_cancel_appointment_client_own_future_confirmed_true(self, client_user, client_profile, employee_profile, service):
        from beauty_salon.permissions import CanCancelAppointment

        appt = baker.make(
            "beauty_salon.Appointment",
            client=client_profile,
            employee=employee_profile,
            service=service,
            start=timezone.now() + timedelta(days=2),
            end=timezone.now() + timedelta(days=2, minutes=60),
            status="CONFIRMED",
        )

        req = APIRequestFactory().delete("/fake")
        req.user = client_user

        perm = CanCancelAppointment()
        assert perm.has_object_permission(req, None, appt) is True
