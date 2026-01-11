import pytest

pytestmark = pytest.mark.integration


def test_booking_rejects_bad_types_and_formats(admin_api_client):

    bad_payloads = [
        {"service_id": "abc", "employee_id": 1, "start": "2026-01-10T10:00:00Z"},
        {"service_id": 1, "employee_id": [], "start": "2026-01-10T10:00:00Z"},
        {"service_id": 1, "employee_id": 1, "start": "not-a-date"},
        {"service_id": None, "employee_id": 1, "start": "2026-01-10T10:00:00Z"},
        {"service_id": 1, "employee_id": None, "start": "2026-01-10T10:00:00Z"},
        {"service_id": 1, "employee_id": 1, "start": None},
    ]

    for payload in bad_payloads:
        resp = admin_api_client.post("/api/appointments/book/", payload, format="json")
        assert resp.status_code in (400, 422)
        assert resp.status_code != 500
