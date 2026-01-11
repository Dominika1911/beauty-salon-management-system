import pytest
from django.contrib.auth import get_user_model

pytestmark = pytest.mark.unit

User = get_user_model()


@pytest.mark.django_db
def test_password_is_hashed_and_check_password_works():
    user = User.objects.create(
        username="admin-00000099",
        role="ADMIN",
        email="hash@test.com",
        is_active=True,
    )
    raw = "SuperSecret123!"
    user.set_password(raw)
    user.save(update_fields=["password"])

    # Hasło nie jest przechowywane w plain-text
    assert user.password != raw
    # Django zapisuje hasło w formacie z segmentami oddzielonymi "$" (hasher$salt$hash)
    assert "$" in user.password

    # check_password weryfikuje poprawność
    assert user.check_password(raw) is True
    assert user.check_password("WrongPassword123!") is False
