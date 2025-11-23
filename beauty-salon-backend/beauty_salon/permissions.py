from rest_framework import permissions

# Pobieranie modelu User dynamicznie (choć w tej wersji nie jest to konieczne,
# to standardowa praktyka przy importach w permissions)
from django.contrib.auth import get_user_model

User = get_user_model()

# Aliasy dla ról, ułatwiające czytanie logiki:
MANAGER = User.RoleChoices.MANAGER
EMPLOYEE = User.RoleChoices.EMPLOYEE
CLIENT = User.RoleChoices.CLIENT


# Funkcja pomocnicza do czystej weryfikacji roli
def has_required_role(user, roles):
    return (
            user.is_authenticated
            and hasattr(user, 'role')
            and user.role in roles
    )


class IsSuperUser(permissions.BasePermission):
    """Tylko superużytkownicy mają dostęp."""

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superuser


class IsManager(permissions.BasePermission):
    """Tylko manager (administrator) ma dostęp."""

    def has_permission(self, request, view):
        return has_required_role(request.user, [MANAGER])


class IsEmployee(permissions.BasePermission):
    """Tylko pracownicy mają dostęp."""

    def has_permission(self, request, view):
        return has_required_role(request.user, [EMPLOYEE])


class IsClient(permissions.BasePermission):
    """Tylko klienci mają dostęp."""

    def has_permission(self, request, view):
        return has_required_role(request.user, [CLIENT])


class IsManagerOrEmployee(permissions.BasePermission):
    """Manager lub pracownik ma dostęp."""

    def has_permission(self, request, view):
        return has_required_role(request.user, [MANAGER, EMPLOYEE])


class IsManagerOrReadOnly(permissions.BasePermission):
    """Manager może edytować, inni tylko odczyt (wymagane uwierzytelnienie)."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated

        return has_required_role(request.user, [MANAGER])


class IsManagerOrEmployeeOrReadOnly(permissions.BasePermission):
    """Manager/pracownik może edytować, inni tylko odczyt (wymagane uwierzytelnienie)."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated

        return has_required_role(request.user, [MANAGER, EMPLOYEE])


class IsClientOwner(permissions.BasePermission):
    """Klient może modyfikować tylko swoje dane. Personel może tylko czytać."""

    def has_object_permission(self, request, view, obj):
        # Odczyt dozwolony dla całego Personelu
        if request.method in permissions.SAFE_METHODS:
            return has_required_role(request.user, [MANAGER, EMPLOYEE, CLIENT])

        # Modyfikacja tylko dla właściciela obiektu
        return obj.user == request.user


class IsAppointmentParticipant(permissions.BasePermission):
    """Dostęp mają: Manager, pracownik przypisany, klient przypisany."""

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        user = request.user
        role = getattr(user, 'role', None)

        if role == MANAGER:
            return True

        if role == EMPLOYEE and hasattr(user, 'employee') and obj.employee == user.employee:
            return True

        if role == CLIENT and hasattr(user, 'client') and obj.client == user.client:
            return True

        return False


class CanManageSchedule(permissions.BasePermission):
    """Zarządzanie harmonogramem - tylko manager i sam pracownik."""

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        user = request.user
        role = getattr(user, 'role', None)

        # Manager może zarządzać wszystkimi harmonogramami
        if role == MANAGER:
            return True

        # Pracownik może zarządzać tylko swoim harmonogramem
        if role == EMPLOYEE and hasattr(user, 'employee') and obj.employee == user.employee:
            return True

        return False


class CanApproveTimeOff(permissions.BasePermission):
    """Tylko manager może zatwierdzać urlopy (na poziomie ogólnym)."""

    def has_permission(self, request, view):
        return has_required_role(request.user, [MANAGER])


class CanViewFinancials(permissions.BasePermission):
    """Dostęp do danych finansowych - tylko manager (na poziomie ogólnym)."""

    def has_permission(self, request, view):
        return has_required_role(request.user, [MANAGER])


class CanManageServices(permissions.BasePermission):
    """Zarządzanie usługami - manager i pracownicy (różne poziomy)."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            # Odczyt dozwolony dla wszystkich uwierzytelnionych
            return request.user.is_authenticated

        # Modyfikacja (POST, PUT, PATCH, DELETE) tylko dla personelu
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
