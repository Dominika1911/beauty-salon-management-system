from __future__ import annotations
from typing import List, Optional, Callable, Any
from django.utils import timezone
from rest_framework import permissions


def _is_authenticated(user) -> bool:
    return bool(user and getattr(user, "is_authenticated", False))


def _role(user) -> Optional[str]:
    role = getattr(user, "role", None)
    return role if isinstance(role, str) else None


def _has_role(user, *roles: str) -> bool:
    r = _role(user)
    if not r:
        return False
    ru = r.upper()
    return any(ru == x.upper() for x in roles)


def _employee(user):
    emp = getattr(user, "employee_profile", None)
    if not emp or not getattr(emp, "is_active", False):
        return None
    return emp


def _client(user):
    return getattr(user, "client_profile", None)


def _admin_or_participant(
    user,
    *,
    obj: Any,
    employee_id_getter: Callable[[Any], Optional[int]],
    client_id_getter: Callable[[Any], Optional[int]],
) -> bool:
    if not _is_authenticated(user):
        return False

    if _has_role(user, "ADMIN"):
        return True

    if _has_role(user, "EMPLOYEE"):
        emp = _employee(user)
        return bool(emp and employee_id_getter(obj) == emp.id)

    if _has_role(user, "CLIENT"):
        cl = _client(user)
        return bool(cl and client_id_getter(obj) == cl.id)

    return False


class RoleBasedPermission(permissions.BasePermission):
    required_roles: List[str] = []

    def has_permission(self, request, view):
        user = request.user
        return _is_authenticated(user) and _has_role(user, *self.required_roles)


class IsAdmin(RoleBasedPermission):
    required_roles = ["ADMIN"]


class IsAdminOrEmployee(RoleBasedPermission):
    required_roles = ["ADMIN", "EMPLOYEE"]


class IsEmployee(RoleBasedPermission):
    required_roles = ["EMPLOYEE"]


class IsClient(RoleBasedPermission):
    required_roles = ["CLIENT"]


class IsReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return _is_authenticated(request.user)

    def has_object_permission(self, request, view, obj):
        user = request.user
        return _admin_or_participant(
            user,
            obj=obj,
            employee_id_getter=lambda _: None,
            client_id_getter=lambda _: None,
        ) or getattr(obj, "user", None) == user


class IsAppointmentParticipant(permissions.BasePermission):
    def has_permission(self, request, view):
        return _is_authenticated(request.user)

    def has_object_permission(self, request, view, obj):
        user = request.user
        return _admin_or_participant(
            user,
            obj=obj,
            employee_id_getter=lambda o: getattr(o, "employee_id", None),
            client_id_getter=lambda o: getattr(o, "client_id", None),
        )


class CanCancelAppointment(permissions.BasePermission):
    def has_permission(self, request, view):
        return _is_authenticated(request.user)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not _is_authenticated(user):
            return False

        if obj.status in [obj.Status.COMPLETED, obj.Status.CANCELLED]:
            return False

        if _has_role(user, "CLIENT") and obj.start < timezone.now():
            return False

        return _admin_or_participant(
            user,
            obj=obj,
            employee_id_getter=lambda o: getattr(o, "employee_id", None),
            client_id_getter=lambda o: getattr(o, "client_id", None),
        )


class CanModifyAppointment(permissions.BasePermission):
    def has_permission(self, request, view):
        return _is_authenticated(request.user)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not _is_authenticated(user):
            return False

        if _has_role(user, "ADMIN"):
            return True

        if _has_role(user, "EMPLOYEE"):
            emp = _employee(user)
            return bool(emp and getattr(obj, "employee_id", None) == emp.id)

        return False


class CanDecideTimeOff(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return _is_authenticated(user) and _has_role(user, "ADMIN")


class CanCancelOwnTimeOff(permissions.BasePermission):
    def has_permission(self, request, view):
        return _is_authenticated(request.user)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not _is_authenticated(user):
            return False

        if _has_role(user, "ADMIN"):
            return True

        if _has_role(user, "EMPLOYEE"):
            return getattr(obj.employee, "user_id", None) == getattr(user, "id", None)

        return False
