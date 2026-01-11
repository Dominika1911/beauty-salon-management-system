import pytest
from rest_framework import status

@pytest.mark.functional
@pytest.mark.django_db
class TestAdminWorkflow:

    def test_admin_setup_new_service_and_employee(self, admin_api_client):

        service_data = {
            'name': 'Strzyżenie męskie',
            'category': 'Włosy',
            'description': 'Profesjonalne strzyżenie dla mężczyzn',
            'price': '60.00',
            'duration_minutes': 45,
            'is_active': True
        }

        response = admin_api_client.post('/api/services/', service_data)
        assert response.status_code == status.HTTP_201_CREATED
        service_id = response.data['id']

        employee_data = {
            'first_name': 'Tomasz',
            'last_name': 'Nowak',
            'phone': '+48500123456',
            'email': 'tomasz@salon.pl'
        }

        response = admin_api_client.post('/api/employees/', employee_data)

        if response.status_code == status.HTTP_201_CREATED:
            employee_id = response.data['id']

            response = admin_api_client.patch(
                f'/api/employees/{employee_id}/',
                {'skills': [service_id]}
            )
            assert response.status_code == status.HTTP_200_OK

        response = admin_api_client.get(f'/api/services/{service_id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Strzyżenie męskie'

    def test_admin_manage_appointments(self, admin_api_client, appointment, confirmed_appointment, service):

        response = admin_api_client.get('/api/appointments/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) >= 2

        response = admin_api_client.get('/api/appointments/?status=PENDING')
        assert response.status_code == status.HTTP_200_OK

        response = admin_api_client.get('/api/statistics/')
        assert response.status_code == status.HTTP_200_OK

        response = admin_api_client.patch(
            f'/api/appointments/{appointment.id}/',
            {'status': 'CONFIRMED'}
        )
        assert response.status_code == status.HTTP_200_OK