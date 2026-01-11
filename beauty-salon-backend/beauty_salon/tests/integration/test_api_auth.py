import pytest
from rest_framework import status


@pytest.mark.integration
@pytest.mark.django_db
class TestAuthenticationAPI:

    def test_login_success(self, api_client, client_user):
        data = {
            "username": "klient-00000001",
            "password": "testpass123",
        }
        response = api_client.post("/api/auth/login/", data)
        assert response.status_code == status.HTTP_200_OK
        assert "user" in response.data

    def test_login_invalid_credentials(self, api_client, client_user):
        data = {
            "username": "klient-00000001",
            "password": "wrongpassword",
        }
        response = api_client.post("/api/auth/login/", data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_nonexistent_user(self, api_client):
        data = {
            "username": "nonexistent@test.com",
            "password": "anypassword",
        }
        response = api_client.post("/api/auth/login/", data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout(self, client_api_client):
        response = client_api_client.post("/api/auth/logout/")
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT]

    def test_get_current_user(self, client_api_client, client_user):
        response = client_api_client.get("/api/auth/status/")
        assert response.status_code == status.HTTP_200_OK
        assert "user" in response.data
        assert response.data["user"]["username"] == "klient-00000001"

    def test_get_current_user_unauthenticated(self, api_client):
        response = api_client.get("/api/auth/status/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["isAuthenticated"] is False
        assert response.data["user"] is None

    def test_register_client(self, api_client):
        data = {
            "username": "newclient",
            "email": "newclient@test.com",
            "password": "securepass123",
            "first_name": "New",
            "last_name": "Client",
            "phone": "+48555123456",
        }
        response = api_client.post("/api/auth/register/", data)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_register_duplicate_email(self, api_client, client_user):
        data = {
            "username": "anotherclient",
            "email": "client@test.com",
            "password": "pass123",
            "first_name": "Test",
            "last_name": "Duplicate",
        }
        response = api_client.post("/api/auth/register/", data)
        assert response.status_code == status.HTTP_404_NOT_FOUND
