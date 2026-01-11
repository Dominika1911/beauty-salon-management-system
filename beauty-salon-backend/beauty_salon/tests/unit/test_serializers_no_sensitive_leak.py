import pytest
from django.contrib.auth import get_user_model

from beauty_salon.serializers import (
    UserListSerializer,
    UserDetailSerializer,
    UserCreateSerializer,
    ClientSerializer,
    ClientPublicSerializer,
)

pytestmark = pytest.mark.unit

User = get_user_model()

SENSITIVE_USER_FIELDS = {
    "password",
    "is_superuser",
    "is_staff",
    "groups",
    "user_permissions",
    "last_login",
}

SENSITIVE_CLIENT_FIELDS = {
    "password",
}


@pytest.mark.django_db
@pytest.mark.parametrize(
    "serializer_cls",
    [
        UserListSerializer,
        UserDetailSerializer,
        UserCreateSerializer,
    ],
)
def test_user_serializers_do_not_expose_sensitive_fields(serializer_cls, admin_user):
    data = serializer_cls(admin_user).data
    keys = set(data.keys())

    assert SENSITIVE_USER_FIELDS.isdisjoint(keys), (
        f"{serializer_cls.__name__} ujawnia pola wrażliwe: "
        f"{sorted(SENSITIVE_USER_FIELDS.intersection(keys))}"
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    "serializer_cls",
    [
        ClientSerializer,
        ClientPublicSerializer,
    ],
)
def test_client_serializers_do_not_expose_sensitive_fields(serializer_cls, client_profile):
    data = serializer_cls(client_profile).data
    keys = set(data.keys())

    assert SENSITIVE_CLIENT_FIELDS.isdisjoint(keys), (
        f"{serializer_cls.__name__} ujawnia pola wrażliwe: "
        f"{sorted(SENSITIVE_CLIENT_FIELDS.intersection(keys))}"
    )
