import pytest
from rest_framework import status
from django.utils import timezone
from datetime import timedelta


@pytest.mark.functional
@pytest.mark.django_db
class TestBookingWorkflow:
    def test_complete_booking_flow(
        self,
        client_api_client,
        admin_api_client,
        service,
        employee_profile,
        employee_schedule,
        system_settings,
    ):

        response = client_api_client.get("/api/services/")
        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert len(response.data["results"]) > 0

        date = timezone.localdate() + timedelta(days=7)
        while date.weekday() >= 5:
            date += timedelta(days=1)
        date_str = date.isoformat()

        url = (
            f"/api/availability/slots/"
            f"?employee_id={employee_profile.id}&service_id={service.id}&date={date_str}"
        )
        response = client_api_client.get(url)
        if response.status_code != status.HTTP_200_OK:
            print("SLOTS STATUS:", response.status_code)
            print("SLOTS DATA:", response.data)
        assert response.status_code == status.HTTP_200_OK

        assert response.data.get("date") == date_str
        assert "slots" in response.data
        assert isinstance(response.data["slots"], list)
        assert len(response.data["slots"]) > 0

        first_slot = response.data["slots"][0]
        assert "start" in first_slot and "end" in first_slot

        booking_data = {
            "service_id": service.id,
            "employee_id": employee_profile.id,
            "start": first_slot["start"],
        }
        response = client_api_client.post("/api/appointments/book/", booking_data)
        if response.status_code not in [status.HTTP_200_OK, status.HTTP_201_CREATED]:
            print("BOOK STATUS:", response.status_code)
            print("BOOK DATA:", response.data)
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]

        appointment_id = response.data.get("id") or response.data.get("appointment_id")
        assert appointment_id is not None

        response = admin_api_client.patch(
            f"/api/appointments/{appointment_id}/",
            {"status": "CANCELLED"},
        )
        if response.status_code not in [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT]:
            print("CANCEL STATUS:", response.status_code)
            print("CANCEL DATA:", response.data)

        assert response.status_code in [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT]
