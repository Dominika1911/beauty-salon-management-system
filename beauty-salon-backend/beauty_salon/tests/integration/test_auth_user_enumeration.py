import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.integration


@pytest.fixture
def csrf_client(db):
    return APIClient(enforce_csrf_checks=True)


def _get_csrf_token(client: APIClient) -> str:
    r = client.get("/api/auth/csrf/")
    assert r.status_code == 200
    return client.cookies["csrftoken"].value


def test_login_does_not_leak_whether_user_exists(csrf_client, admin_user):
    csrf_token = _get_csrf_token(csrf_client)

    # istniejący user, złe hasło
    resp1 = csrf_client.post(
        "/api/auth/login/",
        {"username": admin_user.username, "password": "WRONG"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )

    # nieistniejący user
    resp2 = csrf_client.post(
        "/api/auth/login/",
        {"username": "definitely_not_existing_user_12345", "password": "WRONG"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )

    assert resp1.status_code in (401, 403)
    assert resp2.status_code in (401, 403)

    # Porównujemy odpowiedź (nie powinna zdradzać "user nie istnieje")
    assert resp1.data.get("detail") == resp2.data.get("detail")
