"""
Unit tests for Django signals
Location: beauty_salon/tests/unit/test_signals.py
"""
import pytest
from model_bakery import baker
from django.contrib.auth import get_user_model

User = get_user_model()


# Twoje sygnały TYLKO generują numery, NIE tworzą profili
# Więc testujemy tylko generowanie numerów


@pytest.mark.unit
@pytest.mark.django_db
class TestEmployeeNumberGeneration:
    
    def test_employee_number_auto_generated_on_save(self, db):
        """Test employee_number is generated when profile is saved without number"""
        from beauty_salon.models import EmployeeProfile
        
        user = baker.make(User, username='pracownik-00000099', email='emp@test.com', role='EMPLOYEE')
        
        # Create profile WITHOUT employee_number
        profile = EmployeeProfile(
            user=user,
            first_name='Jan',
            last_name='Kowalski'
        )
        profile.save()  # Signal should generate number
        
        assert profile.employee_number is not None
        assert len(profile.employee_number) == 8
        assert profile.employee_number.isdigit()
    
    def test_employee_numbers_unique(self, db):
        """Test each employee gets unique employee_number"""
        from beauty_salon.models import EmployeeProfile
        
        user1 = baker.make(User, username='pracownik-00000056', email='emp1@test.com', role='EMPLOYEE')
        profile1 = EmployeeProfile.objects.create(user=user1, first_name='A', last_name='B')
        
        user2 = baker.make(User, username='pracownik-00000057', email='emp2@test.com', role='EMPLOYEE')
        profile2 = EmployeeProfile.objects.create(user=user2, first_name='C', last_name='D')
        
        assert profile1.employee_number != profile2.employee_number


@pytest.mark.unit
@pytest.mark.django_db
class TestClientNumberGeneration:
    
    def test_client_number_auto_generated_on_save(self, db):
        """Test client_number is generated when profile is saved without number"""
        from beauty_salon.models import ClientProfile
        
        user = baker.make(User, username='klient-00000099', email='cli@test.com', role='CLIENT')
        
        # Create profile WITHOUT client_number
        profile = ClientProfile(
            user=user,
            first_name='Anna',
            last_name='Nowak'
        )
        profile.save()  # Signal should generate number
        
        assert profile.client_number is not None
        assert len(profile.client_number) == 8
        assert profile.client_number.isdigit()
    
    def test_client_numbers_unique(self, db):
        """Test each client gets unique client_number"""
        from beauty_salon.models import ClientProfile
        
        user1 = baker.make(User, username='klient-00000056', email='cli1@test.com', role='CLIENT')
        profile1 = ClientProfile.objects.create(user=user1, first_name='A', last_name='B')
        
        user2 = baker.make(User, username='klient-00000057', email='cli2@test.com', role='CLIENT')
        profile2 = ClientProfile.objects.create(user=user2, first_name='C', last_name='D')
        
        assert profile1.client_number != profile2.client_number
