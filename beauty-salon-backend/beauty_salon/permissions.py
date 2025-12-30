from rest_framework import permissions
from typing import List


class RoleBasedPermission(permissions.BasePermission):
    """
    Bazowa klasa uprawnień oparta na rolach użytkowników.
    Wymaga zdefiniowania listy 'required_roles' w klasach dziedziczących.
    """

    required_roles: List[str] = []

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        return any(
            getattr(request.user, f"is_{role}", False) for role in self.required_roles
        )


class IsAdmin(RoleBasedPermission):
    """Dostęp tylko dla użytkowników z rolą administratora."""

    required_roles = ["admin"]


class IsAdminOrEmployee(RoleBasedPermission):
    """Dostęp dla administratorów oraz pracowników."""

    required_roles = ["admin", "employee"]


class IsEmployee(RoleBasedPermission):
    """Dostęp tylko dla pracowników."""

    required_roles = ["employee"]


class IsClient(RoleBasedPermission):
    """Dostęp tylko dla klientów."""

    required_roles = ["client"]


class IsReadOnly(permissions.BasePermission):
    """Zezwala jedynie na bezpieczne metody zapytania (GET, HEAD, OPTIONS)."""

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Zezwala na dostęp administratorowi lub właścicielowi obiektu.
    Wymaga obecności atrybutu 'user' w sprawdzanym obiekcie.
    """

    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        if request.user.is_admin:
            return True

        return getattr(obj, "user", None) == request.user


class IsAppointmentParticipant(permissions.BasePermission):
    """
    Weryfikuje, czy użytkownik jest uczestnikiem wizyty (klientem lub przypisanym pracownikiem).
    Wykorzystywane przy autoryzacji dostępu do szczegółów wizyty.
    """

    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user

        if not user.is_authenticated:
            return False

        if user.is_admin:
            return True

        if user.is_employee:
            employee = getattr(user, "employee_profile", None)
            if not employee or not employee.is_active:
                return False
            return obj.employee_id == employee.id

        if user.is_client:
            client = getattr(user, "client_profile", None)
            if not client:
                return False
            return obj.client_id == client.id

        return False


class CanCancelAppointment(permissions.BasePermission):
    """
    Weryfikuje uprawnienia podmiotu do anulowania wizyty.
    Logika biznesowa dotycząca czasu anulowania znajduje się w warstwie widoku.
    """

    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user

        if not user.is_authenticated:
            return False

        if user.is_admin:
            return True

        if user.is_employee:
            employee = getattr(user, "employee_profile", None)
            if not employee or not employee.is_active:
                return False
            return obj.employee_id == employee.id

        if user.is_client:
            client = getattr(user, "client_profile", None)
            if not client:
                return False
            return obj.client_id == client.id

        return False


class CanModifyAppointment(permissions.BasePermission):
    """Weryfikuje uprawnienia do modyfikacji danych wizyty."""

    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user

        if not user.is_authenticated:
            return False

        if user.is_admin:
            return True

        if user.is_employee:
            employee = getattr(user, "employee_profile", None)
            if not employee or not employee.is_active:
                return False
            return obj.employee_id == employee.id

        return False


class CanDecideTimeOff(permissions.BasePermission):
    """Zezwala administratorowi na akceptację lub odrzucenie wniosku urlopowego."""

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin


class CanCancelOwnTimeOff(permissions.BasePermission):
    """Zezwala na anulowanie własnego wniosku urlopowego przez pracownika lub dowolnego przez administratora."""

    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user

        if not user.is_authenticated:
            return False

        if user.is_admin:
            return True

        if user.is_employee:
            return obj.employee.user_id == user.id

        return False
