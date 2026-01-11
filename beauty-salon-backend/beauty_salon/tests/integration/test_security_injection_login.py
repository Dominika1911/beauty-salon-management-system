import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.integration


@pytest.fixture
def csrf_client(db):
    return APIClient(enforce_csrf_checks=True)


def _get_csrf_token(client: APIClient) -> str:
    r = client.get("/api/auth/csrf/")
    assert r.status_code == 200
    assert "csrftoken" in client.cookies
    return client.cookies["csrftoken"].value


def test_login_sql_injection_attempts_are_rejected(csrf_client):
    csrf_token = _get_csrf_token(csrf_client)

    payloads = [
        {"username": "admin' OR 1=1 --", "password": "x"},
        {"username": "' OR '1'='1", "password": "x"},
        {"username": "admin", "password": "' OR 1=1 --"},
        {"username": "admin\" OR \"1\"=\"1", "password": "x"},
    ]

    for p in payloads:
        resp = csrf_client.post(
            "/api/auth/login/",
            p,
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        assert resp.status_code in (400, 401, 403)
        assert resp.status_code != 500
