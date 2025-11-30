from typing import Any
from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.views import APIView
from django.contrib.auth import get_user_model

User = get_user_model()

# Aliasy dla ról
MANAGER = User.RoleChoices.MANAGER
EMPLOYEE = User.RoleChoices.EMPLOYEE
CLIENT = User.RoleChoices.CLIENT


def has_required_role(user: Any, roles: list[str]) -> bool:
    """Funkcja pomocnicza do weryfikacji roli."""
    return (
        user.is_authenticated
        and hasattr(user, "role")
        and user.role in roles
    )


class IsSuperUser(permissions.BasePermission):
    """Tylko superużytkownicy mają dostęp."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return request.user.is_authenticated and request.user.is_superuser


class IsManager(permissions.BasePermission):
    """Tylko manager (administrator) ma dostęp."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_required_role(request.user, [MANAGER])


class IsEmployee(permissions.BasePermission):
    """Tylko pracownicy mają dostęp."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_required_role(request.user, [EMPLOYEE])


class IsClient(permissions.BasePermission):
    """Tylko klienci mają dostęp."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_required_role(request.user, [CLIENT])


class IsManagerOrEmployee(permissions.BasePermission):
    """Manager lub pracownik ma dostęp."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_required_role(request.user, [MANAGER, EMPLOYEE])


class IsManagerOrReadOnly(permissions.BasePermission):
    """Manager może edytować, inni tylko odczyt."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return has_required_role(request.user, [MANAGER])


class IsManagerOrEmployeeOrReadOnly(permissions.BasePermission):
    """Manager/pracownik może edytować, inni tylko odczyt."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return has_required_role(request.user, [MANAGER, EMPLOYEE])


class IsClientOwner(permissions.BasePermission):
    """Klient może modyfikować tylko swoje dane."""

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return has_required_role(request.user, [MANAGER, EMPLOYEE, CLIENT])

        # obj ma typ Any, więc wynik porównania ma też typ Any.
        # Owijamy w bool(), żeby jawnie zwrócić bool i uszczęśliwić mypy.
        if not hasattr(obj, "user"):
            return False

        return bool(obj.user == request.user)


class IsAppointmentParticipant(permissions.BasePermission):
    """Dostęp mają: Manager, pracownik przypisany, klient przypisany."""

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        if not request.user.is_authenticated:
            return False

        user = request.user
        role = getattr(user, "role", None)

        if role == MANAGER:
            return True

        if (
            role == EMPLOYEE
            and hasattr(user, "employee")
            and getattr(user, "employee", None) == obj.employee
        ):
            return True

        if (
            role == CLIENT
            and hasattr(user, "client_profile")
            and getattr(user, "client_profile", None) == obj.client
        ):
            return True

        return False


class CanManageSchedule(permissions.BasePermission):
    """Zarządzanie harmonogramem - tylko manager i sam pracownik."""

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        if not request.user.is_authenticated:
            return False

        user = request.user
        role = getattr(user, "role", None)

        if role == MANAGER:
            return True

        if (
            role == EMPLOYEE
            and hasattr(user, "employee")
            and getattr(user, "employee", None) == obj.employee
        ):
            return True

        return False


class CanApproveTimeOff(permissions.BasePermission):
    """Tylko manager może zatwierdzać urlopy."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_required_role(request.user, [MANAGER])


class CanViewFinancials(permissions.BasePermission):
    """Dostęp do danych finansowych - tylko manager."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_required_role(request.user, [MANAGER])


class CanManageServices(permissions.BasePermission):
    """Zarządzanie usługami - manager i pracownicy."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return has_required_role(request.user, [MANAGER, EMPLOYEE])


__all__ = [
    "IsSuperUser",
    "IsManager",
    "IsEmployee",
    "IsClient",
    "IsManagerOrEmployee",
    "IsManagerOrReadOnly",
    "IsManagerOrEmployeeOrReadOnly",
    "IsClientOwner",
    "IsAppointmentParticipant",
    "CanManageSchedule",
    "CanApproveTimeOff",
    "CanViewFinancials",
    "CanManageServices",
]
