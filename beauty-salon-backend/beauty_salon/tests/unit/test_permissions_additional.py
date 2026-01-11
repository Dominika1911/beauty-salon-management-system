"""
Additional unit tests for permissions
Location: beauty_salon/tests/unit/test_permissions_additional.py
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIRequestFactory
from model_bakery import baker


@pytest.mark.unit
@pytest.mark.django_db
class TestPermissionEdgeCases:

    def test_can_cancel_appointment_client_cannot_cancel_past(self, client_user, client_profile, employee_profile, service):
        from beauty_salon.permissions import CanCancelAppointment

        appointment = baker.make(
            "beauty_salon.Appointment",
            client=client_profile,
            employee=employee_profile,
            service=service,
            start=timezone.now() - timedelta(days=1),
            end=timezone.now() - timedelta(days=1) + timedelta(minutes=60),
            status="CONFIRMED",
        )

        request = APIRequestFactory().delete("/fake")
        request.user = client_user

        perm = CanCancelAppointment()
        assert perm.has_object_permission(request, None, appointment) is False

    def test_can_cancel_appointment_denied_if_completed(self, admin_user, appointment):
        from beauty_salon.permissions import CanCancelAppointment

        appointment.status = "COMPLETED"
        appointment.save()

        request = APIRequestFactory().delete("/fake")
        request.user = admin_user

        perm = CanCancelAppointment()
        assert perm.has_object_permission(request, None, appointment) is False

    def test_can_modify_appointment_employee_only_own(self, employee_user, employee_profile, client_profile, service, create_employees):
        from beauty_salon.permissions import CanModifyAppointment

        other_employee = create_employees(count=1)[0]

        appointment_other = baker.make(
            "beauty_salon.Appointment",
            client=client_profile,
            employee=other_employee,
            service=service,
            start=timezone.now() + timedelta(days=3),
            end=timezone.now() + timedelta(days=3, minutes=60),
            status="PENDING",
        )

        request = APIRequestFactory().patch("/fake")
        request.user = employee_user

        perm = CanModifyAppointment()
        assert perm.has_object_permission(request, None, appointment_other) is False
