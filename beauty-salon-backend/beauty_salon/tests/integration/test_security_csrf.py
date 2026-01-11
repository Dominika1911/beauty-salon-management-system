import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()

pytestmark = pytest.mark.integration


@pytest.fixture
def csrf_client(db):
    return APIClient(enforce_csrf_checks=True)


def test_login_requires_csrf_cookie(csrf_client, admin_user):
    resp = csrf_client.post("/api/auth/login/", {"username": admin_user.username, "password": "testpass123"}, format="json")
    assert resp.status_code in (403, 401, 400)  # zależnie od zachowania middleware/auth


def test_login_with_csrf_cookie_succeeds(csrf_client, admin_user):
    resp = csrf_client.get("/api/auth/csrf/")
    assert resp.status_code == 200
    assert "csrftoken" in csrf_client.cookies

    csrf_token = csrf_client.cookies["csrftoken"].value
    resp = csrf_client.post(
        "/api/auth/login/",
        {"username": admin_user.username, "password": "testpass123"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )
    assert resp.status_code == 200
    assert resp.data.get("user") is not None
