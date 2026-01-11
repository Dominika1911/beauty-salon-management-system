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


def test_multiple_failed_logins_do_not_authenticate_user(csrf_client, admin_user):

    csrf_token = _get_csrf_token(csrf_client)

    for _ in range(10):
        resp = csrf_client.post(
            "/api/auth/login/",
            {"username": admin_user.username, "password": "WRONG_PASSWORD"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        assert resp.status_code in (401, 403)
        assert resp.status_code != 500

    resp = csrf_client.get("/api/auth/status/")
    assert resp.status_code == 200
    assert resp.data["isAuthenticated"] is False
