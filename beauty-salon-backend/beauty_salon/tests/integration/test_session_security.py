import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.integration
@pytest.mark.django_db
class TestSessionSecurity:

    def test_session_created_after_login(self, api_client, admin_user):

        resp = api_client.get('/api/auth/status/')
        assert resp.data['isAuthenticated'] is False

        resp = api_client.post('/api/auth/login/', {
            'username': admin_user.username,
            'password': 'testpass123'
        })
        assert resp.status_code == 200

        resp = api_client.get('/api/auth/status/')
        assert resp.data['isAuthenticated'] is True
        assert resp.data['user']['username'] == admin_user.username

    def test_session_destroyed_after_logout(self, api_client, admin_user):
        api_client.post('/api/auth/login/', {
            'username': admin_user.username,
            'password': 'testpass123'
        })

        resp = api_client.get('/api/auth/status/')
        assert resp.data['isAuthenticated'] is True

        resp = api_client.post('/api/auth/logout/')
        assert resp.status_code == 200

        resp = api_client.get('/api/auth/status/')
        assert resp.data['isAuthenticated'] is False

    def test_password_change_preserves_session(self, api_client, admin_user):

        api_client.post('/api/auth/login/', {
            'username': admin_user.username,
            'password': 'testpass123'
        })

        resp = api_client.post('/api/auth/change-password/', {
            'old_password': 'testpass123',
            'new_password': 'NewSecurePass456!',
            'new_password2': 'NewSecurePass456!'
        })
        assert resp.status_code == 200

        resp = api_client.get('/api/auth/status/')
        assert resp.data['isAuthenticated'] is True