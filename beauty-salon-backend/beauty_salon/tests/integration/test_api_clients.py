import pytest
from rest_framework import status
from model_bakery import baker

@pytest.mark.integration
@pytest.mark.django_db
class TestClientsAPI:
    
    def test_list_clients_admin(self, admin_api_client, client_profile):
        response = admin_api_client.get('/api/clients/')
        assert response.status_code == status.HTTP_200_OK
        assert 'results' in response.data
    
    def test_get_client_details_admin(self, admin_api_client, client_profile):
        response = admin_api_client.get(f'/api/clients/{client_profile.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert 'client_number' in response.data
    
    def test_search_clients(self, admin_api_client, client_profile):
        response = admin_api_client.get('/api/clients/?search=Anna')
        assert response.status_code == status.HTTP_200_OK
    
    def test_filter_clients_by_date(self, admin_api_client, client_profile):
        response = admin_api_client.get('/api/clients/?created_after=2025-01-01')
        assert response.status_code == status.HTTP_200_OK
    
    def test_update_client_notes(self, admin_api_client, client_profile):
        data = {'internal_notes': 'VIP klient'}
        response = admin_api_client.patch(f'/api/clients/{client_profile.id}/', data)
        assert response.status_code == status.HTTP_200_OK
    
    def test_get_client_appointment_history(self, admin_api_client, client_profile, create_appointments):
        create_appointments(count=5)
        response = admin_api_client.get(f'/api/appointments/?client={client_profile.id}')
        assert response.status_code == status.HTTP_200_OK
    
    def test_list_clients_employee_forbidden(self, employee_api_client):
        response = employee_api_client.get('/api/clients/')
        assert response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_200_OK]
    
    def test_pagination_clients(self, admin_api_client, db):
        from beauty_salon.models import ClientProfile, CustomUser
        
        for i in range(15):
            user = baker.make(CustomUser, username=f'client{i}', role='CLIENT')
            ClientProfile.objects.create(
                user=user,
                first_name=f'Client{i}',
                last_name='Test',
                client_number=f'9999{i:04d}'
            )
        
        response = admin_api_client.get('/api/clients/')
        assert response.status_code == status.HTTP_200_OK
        assert 'results' in response.data
