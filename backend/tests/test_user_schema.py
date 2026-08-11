import pytest
from pydantic import ValidationError

from app.schemas.user import UserCreate


def test_password_requires_strong_complexity():
    with pytest.raises(ValidationError) as exc_info:
        UserCreate(full_name="Test User", email="test@example.com", password="weak")

    assert "Password must be at least 8 characters long" in str(exc_info.value)


def test_password_allows_strong_password():
    user = UserCreate(
        full_name="Test User",
        email="test@example.com",
        password="StrongPass123!",
    )

    assert user.password == "StrongPass123!"
