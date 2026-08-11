import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.email_verification import EmailVerificationToken
from app.core.security import hash_verification_token

client = TestClient(app)


def test_email_verification_full_lifecycle():
    unique_suffix = int(datetime.now().timestamp() * 1000)
    email = f"driver_{unique_suffix}@fleetflow.com"
    password = "StrongPassword123!"

    # 1. Signup - creates unverified user
    signup_payload = {
        "full_name": "Test Driver",
        "email": email,
        "password": password,
        "phone": "+1987654321",
        "role": "Driver",
    }
    signup_res = client.post("/auth/signup", json=signup_payload)
    assert signup_res.status_code == 201
    assert "Please verify your email address" in signup_res.json()["message"]

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        assert user.is_verified is False

        # Check that a hashed verification token was created in DB
        token_record = (
            db.query(EmailVerificationToken)
            .filter(EmailVerificationToken.user_id == user.user_id)
            .order_by(EmailVerificationToken.created_at.desc())
            .first()
        )
        assert token_record is not None
        assert token_record.is_used is False
        assert len(token_record.token_hash) == 64  # SHA-256 hex length
    finally:
        db.close()

    # 2. Login BEFORE verification - MUST BE BLOCKED
    login_res = client.post(
        "/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_res.status_code == 403
    assert "Verify your email address before logging in." in login_res.json()["detail"]

    # 3. Attempt verification with invalid token
    invalid_res = client.get("/auth/verify-email?token=invalid_random_token_123")
    assert invalid_res.status_code == 400
    assert "Invalid verification link." in invalid_res.json()["detail"]

    # 4. Generate a known raw token directly for testing verification endpoint
    db = SessionLocal()
    try:
        from app.crud.user import create_verification_token_record
        raw_token = create_verification_token_record(db, user.user_id)
    finally:
        db.close()

    # 5. Verify email with valid token
    verify_res = client.get(f"/auth/verify-email?token={raw_token}")
    assert verify_res.status_code == 200
    assert "Email verified successfully" in verify_res.json()["message"]

    # Check DB state
    db = SessionLocal()
    try:
        updated_user = db.query(User).filter(User.email == email).first()
        assert updated_user is not None
        assert updated_user.is_verified is True

        used_token = (
            db.query(EmailVerificationToken)
            .filter(EmailVerificationToken.token_hash == hash_verification_token(raw_token))
            .first()
        )
        assert used_token.is_used is True
    finally:
        db.close()

    # 6. Attempt token reuse - MUST BE REJECTED or return ALREADY_VERIFIED
    reuse_res = client.get(f"/auth/verify-email?token={raw_token}")
    assert reuse_res.status_code in (200, 400)
    if reuse_res.status_code == 200:
        assert reuse_res.json()["status"] == "already_verified"

    # 7. Login AFTER verification - MUST SUCCEED
    login_success_res = client.post(
        "/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_success_res.status_code == 200
    assert "access_token" in login_success_res.json()


def test_expired_token_handling():
    unique_suffix = int(datetime.now().timestamp() * 1000)
    email = f"expired_{unique_suffix}@fleetflow.com"
    password = "StrongPassword123!"

    signup_payload = {
        "full_name": "Expired Tester",
        "email": email,
        "password": password,
        "role": "Dispatcher",
    }
    signup_res = client.post("/auth/signup", json=signup_payload)
    assert signup_res.status_code == 201

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        
        # Create an already expired token
        from app.core.security import generate_verification_token
        raw_token = generate_verification_token()
        token_hash = hash_verification_token(raw_token)
        expired_at = datetime.now(timezone.utc) - timedelta(hours=2)
        
        token_record = EmailVerificationToken(
            user_id=user.user_id,
            token_hash=token_hash,
            expires_at=expired_at,
            is_used=False,
        )
        db.add(token_record)
        db.commit()
    finally:
        db.close()

    # Attempt to verify with expired token
    verify_res = client.get(f"/auth/verify-email?token={raw_token}")
    assert verify_res.status_code == 400
    assert "expired" in verify_res.json()["detail"].lower()


def test_resend_verification_endpoint():
    unique_suffix = int(datetime.now().timestamp() * 1000)
    email = f"resend_{unique_suffix}@fleetflow.com"
    password = "StrongPassword123!"

    # Signup
    signup_payload = {
        "full_name": "Resend Tester",
        "email": email,
        "password": password,
        "role": "FleetManager",
    }
    signup_res = client.post("/auth/signup", json=signup_payload)
    assert signup_res.status_code == 201

    # Request resend immediately -> Cooldown check (or success if cooldown elapsed)
    resend_res = client.post("/auth/resend-verification", json={"email": email})
    # Since we just signed up, cooldown may trigger (429) or succeed (200)
    assert resend_res.status_code in (200, 429)

    # Unknown email should still return 200 generic message (prevent enumeration)
    unknown_res = client.post("/auth/resend-verification", json={"email": "nonexistent_random_user@domain.com"})
    assert unknown_res.status_code == 200
    assert len(unknown_res.json()["message"]) > 0
