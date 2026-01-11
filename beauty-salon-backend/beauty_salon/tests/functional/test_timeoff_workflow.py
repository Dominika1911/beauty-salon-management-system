"""Test funkcjonalny - Przepływ pracy dla wniosków urlopowych - 100% POPRAWIONY"""
import pytest
from rest_framework import status

@pytest.mark.functional
@pytest.mark.django_db
class TestTimeOffWorkflow:
    """Testy kompletnych procesów zarządzania nieobecnościami"""

    def test_employee_timeoff_approval_flow(self, employee_api_client, admin_api_client, employee_profile):
        """Test pełnego procesu zatwierdzania wniosku urlopowego"""
        # KROK 1: Pracownik składa wniosek
        data = {
            'date_from': '2025-06-01',
            'date_to': '2025-06-07',
            'reason': 'Urlop wypoczynkowy'
        }

        response = employee_api_client.post('/api/time-offs/', data)
        assert response.status_code == status.HTTP_201_CREATED
        timeoff_id = response.data['id']
        assert response.data['status'] == 'PENDING' # Sprawdzenie statusu: OCZEKUJĄCY

        # KROK 2: Administrator przegląda oczekujące wnioski
        response = admin_api_client.get('/api/time-offs/?status=PENDING')
        assert response.status_code == status.HTTP_200_OK

        # KROK 3: Administrator zatwierdza wniosek - POPRAWKA: Użycie akcji /approve/
        response = admin_api_client.post(f'/api/time-offs/{timeoff_id}/approve/')
        assert response.status_code == status.HTTP_200_OK

        # KROK 4: Pracownik sprawdza status zatwierdzenia
        response = employee_api_client.get(f'/api/time-offs/{timeoff_id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'APPROVED' # Sprawdzenie statusu: ZATWIERDZONY

    def test_employee_timeoff_rejection_flow(self, employee_api_client, admin_api_client):
        """Test procesu odrzucenia wniosku urlopowego"""
        # KROK 1: Składanie wniosku
        data = {
            'date_from': '2025-07-15',
            'date_to': '2025-07-20',
            'reason': 'Wyjazd'
        }

        response = employee_api_client.post('/api/time-offs/', data)
        assert response.status_code == status.HTTP_201_CREATED
        timeoff_id = response.data['id']

        # KROK 2: Administrator przegląda szczegóły wniosku
        response = admin_api_client.get(f'/api/time-offs/{timeoff_id}/')
        assert response.status_code == status.HTTP_200_OK

        # KROK 3: Administrator odrzuca wniosek - POPRAWKA: Użycie akcji /reject/
        response = admin_api_client.post(f'/api/time-offs/{timeoff_id}/reject/')
        assert response.status_code == status.HTTP_200_OK

        # KROK 4: Pracownik widzi odrzucony wniosek na liście
        response = employee_api_client.get('/api/time-offs/')
        assert response.status_code == status.HTTP_200_OK