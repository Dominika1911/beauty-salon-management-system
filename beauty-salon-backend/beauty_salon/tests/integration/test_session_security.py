"""
Testy bezpieczeństwa sesji Django
"""
import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.integration
@pytest.mark.django_db
class TestSessionSecurity:
    """Testy bezpieczeństwa sesji"""

    def test_session_created_after_login(self, api_client, admin_user):
        """Test: Sesja jest tworzona po zalogowaniu"""
        # Przed logowaniem - brak sesji
        resp = api_client.get('/api/auth/status/')
        assert resp.data['isAuthenticated'] is False

        # Login
        resp = api_client.post('/api/auth/login/', {
            'username': admin_user.username,
            'password': 'testpass123'
        })
        assert resp.status_code == 200

        # Po logowaniu - jest sesja
        resp = api_client.get('/api/auth/status/')
        assert resp.data['isAuthenticated'] is True
        assert resp.data['user']['username'] == admin_user.username

    def test_session_destroyed_after_logout(self, api_client, admin_user):
        """Test: Sesja jest niszczona po wylogowaniu"""
        # Login
        api_client.post('/api/auth/login/', {
            'username': admin_user.username,
            'password': 'testpass123'
        })

        # Sprawdź że zalogowany
        resp = api_client.get('/api/auth/status/')
        assert resp.data['isAuthenticated'] is True

        # Logout
        resp = api_client.post('/api/auth/logout/')
        assert resp.status_code == 200

        # Sprawdź że wylogowany
        resp = api_client.get('/api/auth/status/')
        assert resp.data['isAuthenticated'] is False

    def test_password_change_preserves_session(self, api_client, admin_user):
        """Test: Zmiana hasła NIE wylogowuje (update_session_auth_hash)"""
        # Login
        api_client.post('/api/auth/login/', {
            'username': admin_user.username,
            'password': 'testpass123'
        })

        # Zmień hasło - POPRAWIONE NAZWY PÓL!
        resp = api_client.post('/api/auth/change-password/', {
            'old_password': 'testpass123',
            'new_password': 'NewSecurePass456!',
            'new_password2': 'NewSecurePass456!'  # <-- new_password2 nie new_password_confirm!
        })
        assert resp.status_code == 200

        # NADAL zalogowany!
        resp = api_client.get('/api/auth/status/')
        assert resp.data['isAuthenticated'] is True