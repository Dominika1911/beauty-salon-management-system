from rest_framework import permissions


class IsSuperUser(permissions.BasePermission):
    """Tylko superużytkownicy mają dostęp."""

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superuser


class IsManager(permissions.BasePermission):
    """Tylko manager (administrator) ma dostęp."""

    def has_permission(self, request, view):
        return (
                request.user.is_authenticated
                and hasattr(request.user, 'role')
                and request.user.role == 'manager'
        )


class IsEmployee(permissions.BasePermission):
    """Tylko pracownicy mają dostęp."""

    def has_permission(self, request, view):
        return (
                request.user.is_authenticated
                and hasattr(request.user, 'role')
                and request.user.role == 'employee'
        )


class IsClient(permissions.BasePermission):
    """Tylko klienci mają dostęp."""

    def has_permission(self, request, view):
        return (
                request.user.is_authenticated
                and hasattr(request.user, 'role')
                and request.user.role == 'client'
        )


class IsManagerOrEmployee(permissions.BasePermission):
    """Manager lub pracownik ma dostęp."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        if not hasattr(request.user, 'role'):
            return False

        return request.user.role in ['manager', 'employee']


class IsManagerOrReadOnly(permissions.BasePermission):
    """Manager może edytować, inni tylko odczyt."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated

        return (
                request.user.is_authenticated
                and hasattr(request.user, 'role')
                and request.user.role == 'manager'
        )


class IsManagerOrEmployeeOrReadOnly(permissions.BasePermission):
    """Manager/pracownik może edytować, inni tylko odczyt."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated

        if not hasattr(request.user, 'role'):
            return False

        return request.user.role in ['manager', 'employee']


class IsClientOwner(permissions.BasePermission):
    """Klient może modyfikować tylko swoje dane."""

    def has_object_permission(self, request, view, obj):
        # Odczyt dozwolony dla pracowników i managera
        if request.method in permissions.SAFE_METHODS:
            if hasattr(request.user, 'role') and request.user.role in ['manager', 'employee']:
                return True

        # Modyfikacja tylko dla właściciela obiektu
        return obj.user == request.user


class IsAppointmentParticipant(permissions.BasePermission):
    """Dostęp mają: manager, pracownik przypisany, klient przypisany."""

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        if not hasattr(request.user, 'role'):
            return False

        # Manager ma pełen dostęp
        if request.user.role == 'manager':
            return True

        # Pracownik przypisany do wizyty
        if request.user.role == 'employee':
            if hasattr(request.user, 'employee') and obj.employee == request.user.employee:
                return True

        # Klient przypisany do wizyty
        if request.user.role == 'client':
            if hasattr(request.user, 'client') and obj.client == request.user.client:
                return True

        return False


class CanManageSchedule(permissions.BasePermission):
    """Zarządzanie harmonogramem - tylko manager i sam pracownik."""

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        if not hasattr(request.user, 'role'):
            return False

        # Manager może zarządzać wszystkimi harmonogramami
        if request.user.role == 'manager':
            return True

        # Pracownik może zarządzać tylko swoim harmonogramem
        if request.user.role == 'employee':
            if hasattr(request.user, 'employee') and obj.employee == request.user.employee:
                return True

        return False


class CanApproveTimeOff(permissions.BasePermission):
    """Tylko manager może zatwierdzać urlopy."""

    def has_permission(self, request, view):
        return (
                request.user.is_authenticated
                and hasattr(request.user, 'role')
                and request.user.role == 'manager'
        )


class CanViewFinancials(permissions.BasePermission):
    """Dostęp do danych finansowych - tylko manager."""

    def has_permission(self, request, view):
        return (
                request.user.is_authenticated
                and hasattr(request.user, 'role')
                and request.user.role == 'manager'
        )


class CanManageServices(permissions.BasePermission):
    """Zarządzanie usługami - manager i pracownicy (różne poziomy)."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        if not hasattr(request.user, 'role'):
            return False

        # Manager może wszystko
        if request.user.role == 'manager':
            return True

        # Pracownicy mogą tylko przeglądać
        if request.user.role == 'employee' and request.method in permissions.SAFE_METHODS:
            return True

        return False