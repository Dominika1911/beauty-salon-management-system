import pytest

pytestmark = pytest.mark.integration


def test_booking_rejects_bad_types_and_formats(admin_api_client):
    """
    Test odporności API na nieprawidłowe typy danych i formaty.
    Oczekujemy błędu walidacji (400/422), nigdy 500.
    """

    bad_payloads = [
        # zły typ ID
        {"service_id": "abc", "employee_id": 1, "start": "2026-01-10T10:00:00Z"},
        {"service_id": 1, "employee_id": [], "start": "2026-01-10T10:00:00Z"},
        # zły format daty
        {"service_id": 1, "employee_id": 1, "start": "not-a-date"},
        # brak wymaganych pól
        {"service_id": None, "employee_id": 1, "start": "2026-01-10T10:00:00Z"},
        {"service_id": 1, "employee_id": None, "start": "2026-01-10T10:00:00Z"},
        {"service_id": 1, "employee_id": 1, "start": None},
    ]

    for payload in bad_payloads:
        resp = admin_api_client.post("/api/appointments/book/", payload, format="json")
        assert resp.status_code in (400, 422)
        assert resp.status_code != 500
