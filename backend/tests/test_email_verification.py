import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.email_verification import EmailVerificationToken
from app.core.security import hash_verification_token

client = TestClient(app)


@patch("app.routers.auth.send_verification_email", return_value=(True, "Email sent successfully"))
def test_email_verification_full_lifecycle(mock_send_email):
    unique_suffix = int(datetime.now().timestamp() * 1000)
    email = f"driver_{unique_suffix}@fleetflow.com"
    password = "StrongPassword123!"

    try:
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
        assert "verification code" in signup_res.json()["message"].lower()

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == email).first()
            assert user is not None
            assert user.is_verified is False

            # Check that a hashed verification token/code was created in DB
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

        # 3. Attempt verification with invalid code
        invalid_res = client.post("/auth/verify-email", json={"email": email, "code": "000000"})
        assert invalid_res.status_code == 400
        assert "Invalid verification code" in invalid_res.json()["detail"]

        # 4. Generate a known raw 6-digit code directly for testing verification endpoint
        db = SessionLocal()
        try:
            from app.crud.user import create_verification_token_record
            raw_code = create_verification_token_record(db, user.user_id)
        finally:
            db.close()

        # 5. Verify email with valid code via POST
        verify_res = client.post("/auth/verify-email", json={"email": email, "code": raw_code})
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
                .filter(EmailVerificationToken.token_hash == hash_verification_token(raw_code))
                .first()
            )
            assert used_token.is_used is True
        finally:
            db.close()

        # 6. Attempt code reuse - MUST BE REJECTED or return ALREADY_VERIFIED
        reuse_res = client.post("/auth/verify-email", json={"email": email, "code": raw_code})
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
    finally:
        with SessionLocal() as db:
            from app.models.driver import Driver
            u = db.query(User).filter(User.email == email).first()
            if u:
                db.query(Driver).filter(Driver.user_id == u.user_id).delete()
                db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == u.user_id).delete()
                db.delete(u)
                db.commit()


@patch("app.routers.auth.send_verification_email", return_value=(True, "Email sent successfully"))
def test_expired_token_handling(mock_send_email):
    unique_suffix = int(datetime.now().timestamp() * 1000)
    email = f"expired_{unique_suffix}@fleetflow.com"
    password = "StrongPassword123!"

    try:
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
            
            # Create an already expired code
            from app.core.security import generate_verification_code
            raw_code = generate_verification_code()
            token_hash = hash_verification_token(raw_code)
            expired_at = datetime.now(timezone.utc) - timedelta(minutes=20)
            
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

        # Attempt to verify with expired code
        verify_res = client.post("/auth/verify-email", json={"email": email, "code": raw_code})
        assert verify_res.status_code == 400
        assert "expired" in verify_res.json()["detail"].lower()
    finally:
        with SessionLocal() as db:
            from app.models.driver import Driver
            u = db.query(User).filter(User.email == email).first()
            if u:
                db.query(Driver).filter(Driver.user_id == u.user_id).delete()
                db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == u.user_id).delete()
                db.delete(u)
                db.commit()


@patch("app.routers.auth.send_verification_email", return_value=(True, "Email sent successfully"))
def test_resend_verification_endpoint(mock_send_email):
    unique_suffix = int(datetime.now().timestamp() * 1000)
    email = f"resend_{unique_suffix}@fleetflow.com"
    password = "StrongPassword123!"

    try:
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
    finally:
        with SessionLocal() as db:
            from app.models.driver import Driver
            u = db.query(User).filter(User.email == email).first()
            if u:
                db.query(Driver).filter(Driver.user_id == u.user_id).delete()
                db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == u.user_id).delete()
                db.delete(u)
                db.commit()

