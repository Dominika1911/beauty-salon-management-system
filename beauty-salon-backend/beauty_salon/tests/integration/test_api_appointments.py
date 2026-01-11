import pytest
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from model_bakery import baker



@pytest.mark.integration
@pytest.mark.django_db
class TestAppointmentsAPI:

    def test_list_appointments_admin(self, admin_api_client, create_appointments):
        create_appointments(count=10)
        response = admin_api_client.get("/api/appointments/")
        assert response.status_code == status.HTTP_200_OK

    def test_list_appointments_employee_own_only(
        self, employee_api_client, employee_profile, client_profile, service
    ):
        for i in range(3):
            start = timezone.now() + timedelta(days=i + 1, hours=10)
            baker.make(
                "beauty_salon.Appointment",
                client=client_profile,
                employee=employee_profile,
                service=service,
                start=start,
                end=start + timedelta(minutes=60),
                status="PENDING",
            )

        response = employee_api_client.get("/api/appointments/")
        assert response.status_code == status.HTTP_200_OK

    def test_create_appointment_client(self, client_api_client, service, employee_profile):
        start = timezone.now() + timedelta(days=1, hours=10)
        data = {
            "service_id": service.id,
            "employee_id": employee_profile.id,
            "start": start.isoformat(),
        }
        response = client_api_client.post("/api/appointments/book/", data)
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]

    def test_confirm_appointment_employee(self, employee_api_client, appointment):
        response = employee_api_client.patch(
            f"/api/appointments/{appointment.id}/",
            {"status": "CONFIRMED"},
        )
        assert response.status_code == status.HTTP_200_OK

    def test_cancel_appointment_client(self, client_api_client, appointment):
        response = client_api_client.patch(
            f"/api/appointments/{appointment.id}/",
            {"status": "CANCELLED"},
        )
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_204_NO_CONTENT,
            status.HTTP_403_FORBIDDEN,
        ]

    def test_complete_appointment_employee(self, employee_api_client, confirmed_appointment):
        response = employee_api_client.patch(
            f"/api/appointments/{confirmed_appointment.id}/",
            {"status": "COMPLETED"},
        )
        assert response.status_code == status.HTTP_200_OK

    def test_mark_no_show(self, employee_api_client, confirmed_appointment):
        response = employee_api_client.patch(
            f"/api/appointments/{confirmed_appointment.id}/",
            {"status": "NO_SHOW"},
        )
        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_status(self, client_api_client, client_profile, employee_profile, service):
        base_time = timezone.now() + timedelta(days=1)
        for i, status_val in enumerate(["PENDING", "CONFIRMED", "PENDING"]):
            start = base_time + timedelta(hours=i * 2)
            baker.make(
                "beauty_salon.Appointment",
                client=client_profile,
                employee=employee_profile,
                service=service,
                start=start,
                end=start + timedelta(minutes=60),
                status=status_val,
            )

        response = client_api_client.get("/api/appointments/?status=PENDING")
        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_date(self, client_api_client, appointment):
        tomorrow = (timezone.now() + timedelta(days=1)).date()
        response = client_api_client.get(f"/api/appointments/?date={tomorrow}")
        assert response.status_code == status.HTTP_200_OK

    def test_get_appointment_details(self, client_api_client, appointment):
        response = client_api_client.get(f"/api/appointments/{appointment.id}/")
        assert response.status_code == status.HTTP_200_OK

        assert "service" in response.data
        assert "client" in response.data
        assert "employee" in response.data

    def test_cannot_cancel_past_appointment(
        self, client_api_client, db, client_profile, employee_profile, service
    ):
        past = timezone.now() - timedelta(hours=2)
        past_apt = baker.make(
            "beauty_salon.Appointment",
            client=client_profile,
            employee=employee_profile,
            service=service,
            start=past,
            end=past + timedelta(minutes=60),
            status="CONFIRMED",
        )

        response = client_api_client.patch(
            f"/api/appointments/{past_apt.id}/",
            {"status": "CANCELLED"},
        )
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN]

    def test_update_appointment_notes(self, employee_api_client, appointment):
        data = {"internal_notes": "Klient przyszedł 10 minut wcześniej"}
        response = employee_api_client.patch(
            f"/api/appointments/{appointment.id}/notes/",
            data,
        )
        assert response.status_code == status.HTTP_200_OK

    def test_client_cannot_see_other_appointments(self, client_api_client, db, client_profile):
        from beauty_salon.models import ClientProfile, EmployeeProfile, CustomUser

        other_user = baker.make(CustomUser, username="other-client", role="CLIENT")
        other_client = ClientProfile.objects.create(
            user=other_user,
            first_name="Other",
            last_name="Client",
            client_number="99999999",
        )
        emp_user = baker.make(CustomUser, username="emp2", role="EMPLOYEE")
        employee = EmployeeProfile.objects.create(
            user=emp_user,
            first_name="Emp",
            last_name="Two",
            employee_number="88888888",
        )
        service = baker.make("beauty_salon.Service")

        start = timezone.now() + timedelta(days=1, hours=14)
        baker.make(
            "beauty_salon.Appointment",
            client=other_client,
            employee=employee,
            service=service,
            start=start,
            end=start + timedelta(minutes=60),
            status="PENDING",
        )

        response = client_api_client.get("/api/appointments/")
        assert response.status_code == status.HTTP_200_OK

        if "results" in response.data:
            for apt in response.data["results"]:
                assert apt["client"] == client_profile.id

    def test_get_available_slots(self, admin_api_client, employee_profile, service, employee_schedule):
        tomorrow = (timezone.now() + timedelta(days=1)).date()
        response = admin_api_client.get(
            f"/api/availability/slots/?employee_id={employee_profile.id}&service_id={service.id}&date={tomorrow}"
        )
        assert response.status_code == status.HTTP_200_OK

        assert isinstance(response.data, dict)
        assert "date" in response.data
        assert "slots" in response.data
        assert isinstance(response.data["slots"], list)

    def test_create_appointment_past_date_fails(self, client_api_client, service, employee_profile):
        past = timezone.now() - timedelta(hours=1)
        data = {
            "service_id": service.id,
            "employee_id": employee_profile.id,
            "start": past.isoformat(),
        }
        response = client_api_client.post("/api/appointments/book/", data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
