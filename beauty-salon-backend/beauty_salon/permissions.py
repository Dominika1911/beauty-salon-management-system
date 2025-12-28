from rest_framework import permissions
from .models import Appointment


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "role")
            and request.user.role == "ADMIN"
        )


class IsAdminOrEmployee(permissions.BasePermission):
    """
    Role-level permission (bez object-level).
    Używaj tylko tam, gdzie nie operujesz na konkretnym obiekcie
    albo gdzie dodatkowe object-level checki są wykonywane gdzie indziej.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "role")
            and request.user.role in ["ADMIN", "EMPLOYEE"]
        )


class IsEmployee(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "role")
            and request.user.role == "EMPLOYEE"
        )


class IsClient(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "role")
            and request.user.role == "CLIENT"
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not hasattr(request.user, "role"):
            return False

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
    ZASADA (BE = source of truth):
    - ADMIN: może anulować każdą wizytę.
    - EMPLOYEE: może anulować tylko wizyty przypisane do niego.
    - CLIENT: może anulować tylko swoją wizytę.

    UWAGA: Ograniczenia czasowe (np. "anulowanie po czasie") powinny
    być egzekwowane w logice endpointu (business rules), a nie w samym permissionie,
    bo permission nie zna np. kontekstu akcji i komunikatów błędów biznesowych.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj: Appointment):
        user = getattr(request, "user", None)

        if not user or not hasattr(user, "role"):
            return False

        role = user.role

        if role == "ADMIN":
            return True

        if role == "EMPLOYEE":
            employee = getattr(user, "employee_profile", None)
            # Bez profilu pracownika nie ma prawa anulować jako EMPLOYEE
            if employee is None or not employee.is_active:
                return False
            # Sprawdź czy można anulować (tylko PENDING/CONFIRMED)
            if obj.status not in [Appointment.Status.PENDING, Appointment.Status.CONFIRMED]:
                return False
            # Tylko wizyty przypisane do tego pracownika
            return obj.employee_id == employee.id

        if role == "CLIENT":
            client = getattr(user, "client_profile", None)
            if client is None:
                return False
            return obj.client_id == client.id

        return False