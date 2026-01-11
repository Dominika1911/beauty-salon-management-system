import pytest
from rest_framework import status

@pytest.mark.functional
@pytest.mark.django_db
class TestTimeOffWorkflow:


    def test_employee_timeoff_approval_flow(self, employee_api_client, admin_api_client, employee_profile):

        data = {
            'date_from': '2025-06-01',
            'date_to': '2025-06-07',
            'reason': 'Urlop wypoczynkowy'
        }

        response = employee_api_client.post('/api/time-offs/', data)
        assert response.status_code == status.HTTP_201_CREATED
        timeoff_id = response.data['id']
        assert response.data['status'] == 'PENDING'

        response = admin_api_client.get('/api/time-offs/?status=PENDING')
        assert response.status_code == status.HTTP_200_OK

        response = admin_api_client.post(f'/api/time-offs/{timeoff_id}/approve/')
        assert response.status_code == status.HTTP_200_OK

        response = employee_api_client.get(f'/api/time-offs/{timeoff_id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'APPROVED'

    def test_employee_timeoff_rejection_flow(self, employee_api_client, admin_api_client):

        data = {
            'date_from': '2025-07-15',
            'date_to': '2025-07-20',
            'reason': 'Wyjazd'
        }

        response = employee_api_client.post('/api/time-offs/', data)
        assert response.status_code == status.HTTP_201_CREATED
        timeoff_id = response.data['id']

        response = admin_api_client.get(f'/api/time-offs/{timeoff_id}/')
        assert response.status_code == status.HTTP_200_OK

        response = admin_api_client.post(f'/api/time-offs/{timeoff_id}/reject/')
        assert response.status_code == status.HTTP_200_OK

        response = employee_api_client.get('/api/time-offs/')
        assert response.status_code == status.HTTP_200_OK