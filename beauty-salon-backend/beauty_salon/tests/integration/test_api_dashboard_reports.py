import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status
from model_bakery import baker


@pytest.mark.integration
@pytest.mark.django_db
class TestDashboardAndReportsAPI:

    def test_dashboard_admin(self, admin_api_client, service, employee_profile, client_profile):
        start_dt = timezone.now() - timedelta(days=1)
        baker.make(
            "beauty_salon.Appointment",
            employee=employee_profile,
            client=client_profile,
            service=service,
            start=start_dt,
            end=start_dt + timedelta(minutes=service.duration_minutes),
            status="COMPLETED",
        )

        response = admin_api_client.get("/api/dashboard/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["role"] == "ADMIN"

        assert "today" in response.data
        assert "current_month" in response.data
        assert "completed_appointments" in response.data["current_month"]
        assert "revenue" in response.data["current_month"]

    def test_dashboard_employee(self, employee_api_client):
        response = employee_api_client.get("/api/dashboard/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["role"] == "EMPLOYEE"

    def test_dashboard_client(self, client_api_client):
        response = client_api_client.get("/api/dashboard/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["role"] == "CLIENT"

    def test_reports_list_admin(self, admin_api_client):
        response = admin_api_client.get("/api/reports/")
        assert response.status_code == status.HTTP_200_OK
        assert "available_reports" in response.data
        assert len(response.data["available_reports"]) >= 3

    def test_reports_unknown_type_returns_400(self, admin_api_client):
        response = admin_api_client.get("/api/reports/unknown-type/")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reports_pdf_returns_pdf(self, admin_api_client):
        response = admin_api_client.get("/api/reports/employee-performance/")
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/pdf"
        assert "attachment" in response.get("Content-Disposition", "")

    def test_reports_forbidden_for_client(self, client_api_client):
        response = client_api_client.get("/api/reports/")
        assert response.status_code == status.HTTP_403_FORBIDDEN
