import pytest
from rest_framework import status

@pytest.mark.integration
@pytest.mark.django_db
class TestTimeOffAPI:
    
    def test_create_timeoff_employee(self, employee_api_client):
        data = {
            'date_from': '2025-03-10',
            'date_to': '2025-03-14',
            'reason': 'Urlop wypoczynkowy'
        }
        response = employee_api_client.post('/api/time-offs/', data)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['status'] == 'PENDING'
    
    def test_list_timeoffs_admin(self, admin_api_client, pending_timeoff):
        response = admin_api_client.get('/api/time-offs/')
        assert response.status_code == status.HTTP_200_OK
        assert 'results' in response.data
    
    def test_approve_timeoff_admin(self, admin_api_client, pending_timeoff):
        response = admin_api_client.post(f'/api/time-offs/{pending_timeoff.id}/approve/')
        assert response.status_code == status.HTTP_200_OK
    
    def test_reject_timeoff_admin(self, admin_api_client, pending_timeoff):
        response = admin_api_client.post(f'/api/time-offs/{pending_timeoff.id}/reject/')
        assert response.status_code == status.HTTP_200_OK
    
    def test_cancel_pending_timeoff_employee(self, employee_api_client, pending_timeoff):
        response = employee_api_client.post(f'/api/time-offs/{pending_timeoff.id}/cancel/')
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT, status.HTTP_404_NOT_FOUND]
    
    def test_cannot_cancel_approved_timeoff(self, employee_api_client, approved_timeoff):
        response = employee_api_client.post(f'/api/time-offs/{approved_timeoff.id}/cancel/')
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND]
    
    def test_filter_timeoffs_by_status(self, admin_api_client, pending_timeoff, approved_timeoff):
        response = admin_api_client.get('/api/time-offs/?status=PENDING')
        assert response.status_code == status.HTTP_200_OK
        for timeoff in response.data['results']:
            assert timeoff['status'] == 'PENDING'
    
    def test_list_own_timeoffs_employee(self, employee_api_client, pending_timeoff):
        response = employee_api_client.get('/api/time-offs/')
        assert response.status_code == status.HTTP_200_OK
    
    def test_client_cannot_create_timeoff(self, client_api_client):
        data = {'date_from': '2025-04-01', 'date_to': '2025-04-05', 'reason': 'Test'}
        response = client_api_client.post('/api/time-offs/', data)
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_get_timeoff_details(self, admin_api_client, pending_timeoff):
        response = admin_api_client.get(f'/api/time-offs/{pending_timeoff.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == pending_timeoff.id
