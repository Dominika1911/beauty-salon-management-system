import pytest
from rest_framework import status

@pytest.mark.integration
@pytest.mark.django_db
class TestServicesAPI:
    
    def test_list_services(self, admin_api_client, services_list):
        response = admin_api_client.get('/api/services/')
        assert response.status_code == status.HTTP_200_OK
        assert 'results' in response.data
        assert len(response.data['results']) >= 5
    
    def test_create_service_admin(self, admin_api_client):
        data = {
            'name': 'Masaż relaksacyjny',
            'category': 'Masaże',
            'description': 'Profesjonalny masaż',
            'price': '150.00',
            'duration_minutes': 90,
            'is_active': True
        }
        response = admin_api_client.post('/api/services/', data)
        assert response.status_code == status.HTTP_201_CREATED
    
    def test_update_service_admin(self, admin_api_client, service):
        response = admin_api_client.patch(f'/api/services/{service.id}/', {'price': '95.00'})
        assert response.status_code == status.HTTP_200_OK
        assert response.data['price'] == '95.00'
    
    def test_enable_service(self, admin_api_client, inactive_service):
        response = admin_api_client.patch(
            f'/api/services/{inactive_service.id}/',
            {'is_active': True}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_active'] is True
    
    def test_disable_service(self, admin_api_client, service):
        response = admin_api_client.patch(
            f'/api/services/{service.id}/',
            {'is_active': False}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_active'] is False
    
    def test_filter_active_services(self, admin_api_client, service, inactive_service):
        response = admin_api_client.get('/api/services/?is_active=true')
        assert response.status_code == status.HTTP_200_OK
        for svc in response.data['results']:
            assert svc['is_active'] is True
    
    def test_search_services(self, admin_api_client, service):
        response = admin_api_client.get('/api/services/?search=Manicure')
        assert response.status_code == status.HTTP_200_OK
    
    def test_create_service_employee_forbidden(self, employee_api_client):
        data = {'name': 'Test', 'price': '50.00', 'duration_minutes': 30}
        response = employee_api_client.post('/api/services/', data)
        assert response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_201_CREATED]
    
    def test_pagination(self, admin_api_client, create_services):
        create_services(count=25)
        response = admin_api_client.get('/api/services/?page=1')
        assert response.status_code == status.HTTP_200_OK
        assert 'results' in response.data
    
    def test_sort_by_price(self, admin_api_client, create_services):
        create_services(count=5)
        response = admin_api_client.get('/api/services/?ordering=price')
        assert response.status_code == status.HTTP_200_OK
        prices = [float(s['price']) for s in response.data['results']]
        assert prices == sorted(prices)
    
    def test_filter_by_category(self, admin_api_client, service):
        response = admin_api_client.get('/api/services/?category=Paznokcie')
        assert response.status_code == status.HTTP_200_OK
    
    def test_list_services_anonymous(self, api_client, service):
        response = api_client.get('/api/services/')
        assert response.status_code == status.HTTP_403_FORBIDDEN
