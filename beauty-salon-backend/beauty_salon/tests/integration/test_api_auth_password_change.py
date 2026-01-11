import pytest
from rest_framework import status

@pytest.mark.integration
@pytest.mark.django_db
class TestAuthPasswordChangeAPI:

    def test_change_password_success(self, client_api_client, client_user):
        payload = {
            "old_password": "testpass123",
            "new_password": "NewStrongPassword123!",
            "new_password2": "NewStrongPassword123!",
        }
        response = client_api_client.post("/api/auth/change-password/", payload)
        assert response.status_code == status.HTTP_200_OK
        assert "detail" in response.data

    def test_change_password_wrong_old_password(self, client_api_client):
        payload = {
            "old_password": "wrong-password-here",
            "new_password": "NewStrongPassword123!",
            "new_password2": "NewStrongPassword123!",
        }
        response = client_api_client.post("/api/auth/change-password/", payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "old_password" in response.data

    def test_change_password_mismatch(self, client_api_client):
        payload = {
            "old_password": "testpass123",
            "new_password": "NewStrongPassword123!",
            "new_password2": "DIFFERENT!",
        }
        response = client_api_client.post("/api/auth/change-password/", payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "new_password2" in response.data