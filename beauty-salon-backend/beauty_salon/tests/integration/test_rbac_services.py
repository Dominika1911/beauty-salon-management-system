import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

pytestmark = pytest.mark.integration
User = get_user_model()


@pytest.fixture
def csrf_client(db):
    return APIClient(enforce_csrf_checks=True)


def _get_csrf(client: APIClient) -> str:
    r = client.get("/api/auth/csrf/")
    assert r.status_code == 200
    assert "csrftoken" in client.cookies
    return client.cookies["csrftoken"].value


def _login(client: APIClient, username: str, password: str):
    # upewnij się, że mamy CSRF przed loginem
    csrf = _get_csrf(client)
    r = client.post(
        "/api/auth/login/",
        {"username": username, "password": password},
        format="json",
        HTTP_X_CSRFTOKEN=csrf,
    )
    assert r.status_code == 200

    # po loginie bierzemy AKTUALNY token z cookies (na wypadek rotacji)
    assert "csrftoken" in client.cookies
    return client.cookies["csrftoken"].value


def test_services_create_requires_auth(csrf_client):
    csrf = _get_csrf(csrf_client)

    payload = {
        "name": "RBAC Test Service",
        "category": "Test",
        "description": "Service created in RBAC test",
        "price": "99.99",
        "duration_minutes": 60,
        "is_active": True,
    }

    r = csrf_client.post("/api/services/", payload, format="json", HTTP_X_CSRFTOKEN=csrf)
    assert r.status_code in (401, 403)


def test_services_create_forbidden_for_regular_user(csrf_client):

    user = User.objects.create_user(username="regular_user", password="regular_pass_123", role="CLIENT")

    csrf = _login(csrf_client, "regular_user", "regular_pass_123")

    payload = {
        "name": "RBAC Test Service 2",
        "category": "Test",
        "description": "Service created in RBAC test",
        "price": "49.99",
        "duration_minutes": 30,
        "is_active": True,
    }

    r = csrf_client.post("/api/services/", payload, format="json", HTTP_X_CSRFTOKEN=csrf)
    assert r.status_code == 403


def test_services_create_allowed_for_admin(csrf_client, admin_user):
    # admin_user w Twoim conftest ma role="ADMIN"
    csrf = _login(csrf_client, admin_user.username, "testpass123")

    payload = {
        "name": "RBAC Admin Service",
        "category": "Test",
        "description": "Service created by admin in RBAC test",
        "price": "199.99",
        "duration_minutes": 90,
        "is_active": True,
    }

    r = csrf_client.post("/api/services/", payload, format="json", HTTP_X_CSRFTOKEN=csrf)

    # create w ServiceViewSet wymaga IsAdminOrEmployee (Twoje permissions.py)
    assert r.status_code == 201
    assert r.data["name"] == payload["name"]
