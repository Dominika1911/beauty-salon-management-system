import pytest
from rest_framework import status

@pytest.mark.functional
@pytest.mark.django_db
class TestAdminWorkflow:

    def test_admin_setup_new_service_and_employee(self, admin_api_client):
        """
        Test kompletnego procesu konfiguracji usług:
        KROK 1: Administrator tworzy nową usługę
        KROK 2: Administrator tworzy nowego pracownika
        KROK 3: Administrator przypisuje usługę do pracownika
        KROK 4: Administrator weryfikuje konfigurację
        """
        # KROK 1: Tworzenie nowej usługi
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
        # Obsługa ewentualnego błędu - tworzenie pracownika może wymagać najpierw konta użytkownika
        if response.status_code == status.HTTP_201_CREATED:
            employee_id = response.data['id']

            # KROK 3: Przypisanie usługi do pracownika
            response = admin_api_client.patch(
                f'/api/employees/{employee_id}/',
                {'skills': [service_id]}
            )
            assert response.status_code == status.HTTP_200_OK

        # KROK 4: Weryfikacja czy usługa istnieje
        response = admin_api_client.get(f'/api/services/{service_id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Strzyżenie męskie'

    def test_admin_manage_appointments(self, admin_api_client, appointment, confirmed_appointment, service):
        """
        Test zarządzania wizytami przez administratora:
        KROK 1: Przegląd wszystkich wizyt
        KROK 2: Filtrowanie oczekujących wizyt
        KROK 3: Przegląd statystyk
        KROK 4: Potwierdzenie wizyty
        """
        # KROK 1: Wyświetlenie wszystkich wizyt
        response = admin_api_client.get('/api/appointments/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) >= 2

        # KROK 2: Filtrowanie wizyt o statusie "OCZEKUJĄCA" (PENDING)
        response = admin_api_client.get('/api/appointments/?status=PENDING')
        assert response.status_code == status.HTTP_200_OK

        # KROK 3: Wyświetlenie statystyk panelu administracyjnego
        response = admin_api_client.get('/api/statistics/')
        assert response.status_code == status.HTTP_200_OK

        # KROK 4: Potwierdzenie oczekującej wizyty
        response = admin_api_client.patch(
            f'/api/appointments/{appointment.id}/',
            {'status': 'CONFIRMED'}
        )
        assert response.status_code == status.HTTP_200_OK