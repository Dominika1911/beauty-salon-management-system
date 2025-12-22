from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """
    Uprawnienie dla administratorów.
    Wymaga zalogowania i roli ADMIN.
    """

    def has_permission(self, request, view):
        return (
                request.user
                and request.user.is_authenticated
                and request.user.role == 'ADMIN'
        )


class IsAdminOrEmployee(permissions.BasePermission):
    """
    Uprawnienie dla administratorów i pracowników.
    Wymaga zalogowania i roli ADMIN lub EMPLOYEE.
    """

    def has_permission(self, request, view):
        return (
                request.user
                and request.user.is_authenticated
                and request.user.role in ['ADMIN', 'EMPLOYEE']
        )


class IsEmployee(permissions.BasePermission):
    """
    Uprawnienie tylko dla pracowników.
    Wymaga zalogowania i roli EMPLOYEE.
    """

    def has_permission(self, request, view):
        return (
                request.user
                and request.user.is_authenticated
                and request.user.role == 'EMPLOYEE'
        )


class IsClient(permissions.BasePermission):
    """
    Uprawnienie dla klientów.
    Wymaga zalogowania i roli CLIENT.
    """

    def has_permission(self, request, view):
        return (
                request.user
                and request.user.is_authenticated
                and request.user.role == 'CLIENT'
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Uprawnienie pozwalające na dostęp właścicielowi zasobu lub administratorowi.
    Używane dla object-level permissions.
    """

    def has_object_permission(self, request, view, obj):
        # Admin ma zawsze dostęp
        if request.user.role == 'ADMIN':
            return True

        # Sprawdź czy użytkownik jest właścicielem obiektu
        # Dostosuj logikę w zależności od modelu
        if hasattr(obj, 'user'):
            return obj.user == request.user

        return False


class ReadOnly(permissions.BasePermission):
    """
    Uprawnienie tylko do odczytu (GET, HEAD, OPTIONS).
    """

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS