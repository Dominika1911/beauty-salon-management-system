from rest_framework import permissions
from .models import Appointment


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "ADMIN")


class IsAdminOrEmployee(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in ["ADMIN", "EMPLOYEE"])


class IsEmployee(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "EMPLOYEE")


class IsClient(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "CLIENT")


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.role == "ADMIN":
            return True
        if hasattr(obj, "user"):
            return obj.user == request.user
        return False


class ReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS


class CanCancelAppointment(permissions.BasePermission):
    """
    - ADMIN/EMPLOYEE: mogą anulować każdą wizytę
    - CLIENT: może anulować tylko swoją wizytę
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj: Appointment):
        role = getattr(request.user, "role", None)

        if role in ["ADMIN", "EMPLOYEE"]:
            return True

        if role == "CLIENT":
            client = getattr(request.user, "client_profile", None)
            return client is not None and obj.client_id == client.id

        return False
