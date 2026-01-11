import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status
from model_bakery import baker


@pytest.mark.integration
@pytest.mark.django_db
class TestCheckAvailabilityAPI:

    def test_missing_fields_returns_400(self, client_api_client):
        response = client_api_client.post("/api/appointments/check-availability/", {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "detail" in response.data

    def test_invalid_employee_returns_404(self, client_api_client, service):
        start = (timezone.now() + timedelta(days=1)).isoformat()
        payload = {"employee_id": 999999, "service_id": service.id, "start": start}
        response = client_api_client.post("/api/appointments/check-availability/", payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data["available"] is False

    def test_invalid_service_returns_404(self, client_api_client, employee_profile):
        start = (timezone.now() + timedelta(days=1)).isoformat()
        payload = {"employee_id": employee_profile.id, "service_id": 999999, "start": start}
        response = client_api_client.post("/api/appointments/check-availability/", payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data["available"] is False

    def test_invalid_date_format_returns_400(self, client_api_client, employee_profile, service):
        payload = {"employee_id": employee_profile.id, "service_id": service.id, "start": "not-a-date"}
        response = client_api_client.post("/api/appointments/check-availability/", payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["available"] is False

    def test_employee_timeoff_returns_not_available(self, client_api_client, employee_profile, service):
        employee_profile.skills.add(service)

        start_dt = timezone.now() + timedelta(days=2)
        baker.make(
            "beauty_salon.TimeOff",
            employee=employee_profile,
            status="APPROVED",
            date_from=start_dt.date(),
            date_to=start_dt.date(),
        )

        payload = {"employee_id": employee_profile.id, "service_id": service.id, "start": start_dt.isoformat()}
        response = client_api_client.post("/api/appointments/check-availability/", payload)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["available"] is False
        assert "nieobecny" in response.data["reason"].lower()

    def test_conflict_with_existing_appointment_returns_not_available(
        self, client_api_client, employee_profile, client_profile, service
    ):
        employee_profile.skills.add(service)

        start_dt = timezone.now() + timedelta(days=3, hours=10)
        end_dt = start_dt + timedelta(minutes=service.duration_minutes)

        baker.make(
            "beauty_salon.Appointment",
            employee=employee_profile,
            client=client_profile,
            service=service,
            start=start_dt,
            end=end_dt,
            status="CONFIRMED",
        )

        payload = {"employee_id": employee_profile.id, "service_id": service.id, "start": start_dt.isoformat()}
        response = client_api_client.post("/api/appointments/check-availability/", payload)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["available"] is False
        assert "zarezerwowaną" in response.data["reason"].lower()

    def test_available_returns_true_and_end_time(self, client_api_client, employee_profile, service, system_settings):
        employee_profile.skills.add(service)

        start_dt = timezone.now() + timedelta(days=4, hours=9)
        payload = {"employee_id": employee_profile.id, "service_id": service.id, "start": start_dt.isoformat()}
        response = client_api_client.post("/api/appointments/check-availability/", payload)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["available"] is True
        assert "start" in response.data and "end" in response.data
        assert "duration_minutes" in response.data
