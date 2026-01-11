import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIRequestFactory
from model_bakery import baker
from django.contrib.auth.models import AnonymousUser


@pytest.mark.unit
@pytest.mark.django_db
class TestBookingCreateSerializer:

    def test_unauthenticated_cannot_book(self, service, employee_profile):
        from beauty_salon.serializers import BookingCreateSerializer

        factory = APIRequestFactory()
        request = factory.post("/api/appointments/book/")
        request.user = AnonymousUser()

        data = {
            "service_id": service.id,
            "employee_id": employee_profile.id,
            "start": timezone.now() + timedelta(days=2),
        }

        serializer = BookingCreateSerializer(data=data, context={"request": request})

        assert serializer.is_valid() is False
        assert serializer.errors == {
            "detail": ["Musisz być zalogowany aby zarezerwować wizytę."]
        }

    def test_client_cannot_pass_client_id(self, client_user, service, employee_profile):
        from beauty_salon.serializers import BookingCreateSerializer

        factory = APIRequestFactory()
        request = factory.post("/api/appointments/book/")
        request.user = client_user

        data = {
            "service_id": service.id,
            "employee_id": employee_profile.id,
            "client_id": 123,
            "start": timezone.now() + timedelta(days=2),
        }

        serializer = BookingCreateSerializer(data=data, context={"request": request})

        assert serializer.is_valid() is False
        assert "client_id" in serializer.errors

    def test_cannot_book_in_past(self, client_user, service, employee_profile):
        from beauty_salon.serializers import BookingCreateSerializer

        employee_profile.skills.add(service)

        factory = APIRequestFactory()
        request = factory.post("/api/appointments/book/")
        request.user = client_user

        data = {
            "service_id": service.id,
            "employee_id": employee_profile.id,
            "start": timezone.now() - timedelta(days=1),
        }

        serializer = BookingCreateSerializer(data=data, context={"request": request})

        assert serializer.is_valid() is False
        assert "start" in serializer.errors

    def test_employee_must_have_skill_for_service(self, client_user, service):
        from beauty_salon.serializers import BookingCreateSerializer

        employee_user = baker.make(
            "beauty_salon.CustomUser", role="EMPLOYEE", is_active=True
        )
        employee_profile = baker.make(
            "beauty_salon.EmployeeProfile", user=employee_user, is_active=True
        )
        employee_profile.skills.clear()

        factory = APIRequestFactory()
        request = factory.post("/api/appointments/book/")
        request.user = client_user

        data = {
            "service_id": service.id,
            "employee_id": employee_profile.id,
            "start": timezone.now() + timedelta(days=2),
        }

        serializer = BookingCreateSerializer(data=data, context={"request": request})

        assert serializer.is_valid() is False
        assert serializer.errors == {
            "employee_id": ["Ten pracownik nie wykonuje wybranej usługi."]
        }

    def test_conflict_employee_busy(self, client_user, client_profile, service, employee_profile):
        from beauty_salon.serializers import BookingCreateSerializer

        employee_profile.skills.add(service)

        start_dt = timezone.now() + timedelta(days=3, hours=10)

        baker.make(
            "beauty_salon.Appointment",
            client=client_profile,
            employee=employee_profile,
            service=service,
            start=start_dt,
            end=start_dt + timedelta(minutes=service.duration_minutes),
            status="CONFIRMED",
        )

        factory = APIRequestFactory()
        request = factory.post("/api/appointments/book/")
        request.user = client_user

        data = {
            "service_id": service.id,
            "employee_id": employee_profile.id,
            "start": start_dt,
        }

        serializer = BookingCreateSerializer(data=data, context={"request": request})

        assert serializer.is_valid() is False
        assert "start" in serializer.errors

    def test_client_can_book_when_valid(self, client_user, service):
        from beauty_salon.serializers import BookingCreateSerializer

        employee_user = baker.make(
            "beauty_salon.CustomUser", role="EMPLOYEE", is_active=True
        )
        employee_profile = baker.make(
            "beauty_salon.EmployeeProfile", user=employee_user, is_active=True
        )
        employee_profile.skills.add(service)

        factory = APIRequestFactory()
        request = factory.post("/api/appointments/book/")
        request.user = client_user

        data = {
            "service_id": service.id,
            "employee_id": employee_profile.id,
            "start": timezone.now() + timedelta(days=2),
        }

        serializer = BookingCreateSerializer(data=data, context={"request": request})

        assert serializer.is_valid() is True
        assert serializer.validated_data["service"].id == service.id
        assert serializer.validated_data["employee"].id == employee_profile.id
