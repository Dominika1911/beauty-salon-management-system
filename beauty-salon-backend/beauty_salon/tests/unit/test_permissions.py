"""
Unit tests for DRF permissions
Location: beauty_salon/tests/unit/test_permissions.py
"""
import pytest
from unittest.mock import Mock


@pytest.mark.unit
@pytest.mark.django_db
class TestIsAdminPermission:
    
    def test_admin_has_permission(self, admin_user):
        """Test admin user has permission"""
        from beauty_salon.permissions import IsAdmin
        
        permission = IsAdmin()
        request = Mock()
        request.user = admin_user
        
        assert permission.has_permission(request, None) is True
    
    def test_employee_no_permission(self, employee_user):
        """Test employee user has no admin permission"""
        from beauty_salon.permissions import IsAdmin
        
        permission = IsAdmin()
        request = Mock()
        request.user = employee_user
        
        assert permission.has_permission(request, None) is False
    
    def test_client_no_permission(self, client_user):
        """Test client user has no admin permission"""
        from beauty_salon.permissions import IsAdmin
        
        permission = IsAdmin()
        request = Mock()
        request.user = client_user
        
        assert permission.has_permission(request, None) is False


@pytest.mark.unit
@pytest.mark.django_db
class TestIsEmployeePermission:
    
    def test_employee_has_permission(self, employee_user):
        """Test employee user has permission"""
        from beauty_salon.permissions import IsEmployee
        
        permission = IsEmployee()
        request = Mock()
        request.user = employee_user
        
        assert permission.has_permission(request, None) is True
    
    def test_client_no_permission(self, client_user):
        """Test client user has no employee permission"""
        from beauty_salon.permissions import IsEmployee
        
        permission = IsEmployee()
        request = Mock()
        request.user = client_user
        
        assert permission.has_permission(request, None) is False


@pytest.mark.unit
@pytest.mark.django_db
class TestIsClientPermission:
    
    def test_client_has_permission(self, client_user):
        """Test client user has permission"""
        from beauty_salon.permissions import IsClient
        
        permission = IsClient()
        request = Mock()
        request.user = client_user
        
        assert permission.has_permission(request, None) is True
    
    def test_employee_no_permission(self, employee_user):
        """Test employee user has no client permission"""
        from beauty_salon.permissions import IsClient
        
        permission = IsClient()
        request = Mock()
        request.user = employee_user
        
        assert permission.has_permission(request, None) is False
