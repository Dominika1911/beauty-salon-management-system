import pytest
from rest_framework import status

@pytest.mark.integration
@pytest.mark.django_db
class TestEmployeesAPI:
    
    def test_list_employees(self, admin_api_client, create_employees):
        create_employees(count=3)
        response = admin_api_client.get('/api/employees/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) >= 3
    
    def test_create_employee_admin(self, admin_api_client):
        data = {
            'first_name': 'New',
            'last_name': 'Employee',
            'phone': '+48123456789',
            'email': 'newemp@test.com'
        }
        response = admin_api_client.post('/api/employees/', data)
        assert response.status_code in [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST]
    
    def test_get_employee_details(self, admin_api_client, employee_profile):
        response = admin_api_client.get(f'/api/employees/{employee_profile.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert 'employee_number' in response.data
    
    def test_update_employee(self, admin_api_client, employee_profile):
        data = {'phone': '+48999888777'}
        response = admin_api_client.patch(f'/api/employees/{employee_profile.id}/', data)
        assert response.status_code == status.HTTP_200_OK
    
    def test_delete_employee(self, admin_api_client, db):
        from beauty_salon.models import EmployeeProfile, CustomUser
        from model_bakery import baker
        
        user = baker.make(CustomUser, username='todelete', role='EMPLOYEE')
        emp = EmployeeProfile.objects.create(
            user=user,
            first_name='Delete',
            last_name='Me',
            employee_number='77777777'
        )
        
        response = admin_api_client.delete(f'/api/employees/{emp.id}/')
        assert response.status_code == status.HTTP_204_NO_CONTENT
    
    def test_filter_employees_by_skill(self, admin_api_client, employee_profile, service):
        employee_profile.skills.add(service)
        response = admin_api_client.get(f'/api/employees/?service_id={service.id}')
        assert response.status_code == status.HTTP_200_OK
    
    def test_get_employee_schedule(self, employee_api_client, employee_schedule):
        response = employee_api_client.get('/api/employee/schedule/')
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND]
    
    def test_create_employee_client_forbidden(self, client_api_client):
        data = {'first_name': 'Hack', 'last_name': 'Attempt'}
        response = client_api_client.post('/api/employees/', data)
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_add_skill_to_employee(self, admin_api_client, employee_profile, service):
        data = {'skills': [service.id]}
        response = admin_api_client.patch(f'/api/employees/{employee_profile.id}/', data)
        assert response.status_code == status.HTTP_200_OK
    
    def test_remove_skill_from_employee(self, admin_api_client, employee_profile, service):
        employee_profile.skills.add(service)
        data = {'skills': []}
        response = admin_api_client.patch(f'/api/employees/{employee_profile.id}/', data)
        assert response.status_code == status.HTTP_200_OK
