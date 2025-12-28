from rest_framework import permissions

from .models import Appointment


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin


class IsAdminOrEmployee(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_admin or request.user.is_employee
        )


class IsEmployee(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_employee


class IsClient(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_client


class ReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        return request.user.is_authenticated and (
            request.user.is_admin or getattr(obj, "user", None) == request.user
        )


class CanCancelAppointment(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj: Appointment):
        if request.user.is_admin:
            return True

        if request.user.is_employee:
            employee = getattr(request.user, "employee_profile", None)
            if employee is None or not employee.is_active:
                return False
            if obj.status not in (Appointment.Status.PENDING, Appointment.Status.CONFIRMED):
                return False
            return obj.employee_id == employee.id

        if request.user.is_client:
            client = getattr(request.user, "client_profile", None)
            return bool(client and obj.client_id == client.id)

        return False
