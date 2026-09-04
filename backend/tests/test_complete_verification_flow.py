import os
import sys
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
def test_complete_flow_tests_1_through_11(mock_send_email):
    unique_suffix = int(datetime.now().timestamp() * 1000)
    email = f"e2e_{unique_suffix}@fleetflow.com"
    unverified_temp_email = f"unverified_invalid_{unique_suffix}@fleetflow.com"
    expired_user_email = f"expired_flow_{unique_suffix}@fleetflow.com"
    unverified_email = f"resend_test_{unique_suffix}@fleetflow.com"
    password = "E2E_Password123!"

    try:
        # =========================================================================
        # TEST 1: New signup -> Expected: 201 Created
        # =========================================================================
        signup_res = client.post(
            "/auth/signup",
            json={
                "full_name": "E2E Flow Tester",
                "email": email,
                "password": password,
                "phone": "+15551234567",
                "role": "Driver",
            },
        )
        assert signup_res.status_code == 201, f"Signup failed: {signup_res.text}"
        signup_data = signup_res.json()
        assert "verification code" in signup_data["message"].lower()

        # Verify user initially has is_verified=False in PostgreSQL
        with SessionLocal() as db:
            user_db = db.query(User).filter(User.email == email).first()
            assert user_db is not None
            assert user_db.is_verified is False
            assert user_db.email_verified is False

            # Retrieve the token created during signup
            token_record = (
                db.query(EmailVerificationToken)
                .filter(EmailVerificationToken.user_id == user_db.user_id)
                .first()
            )
            assert token_record is not None
            assert token_record.is_used is False

        # =========================================================================
        # TEST 2: Login before verification -> Expected: 403 "Verify your email address before logging in."
        # =========================================================================
        login_unverified_res = client.post(
            "/auth/login",
            data={"username": email, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert login_unverified_res.status_code == 403
        assert login_unverified_res.json()["detail"] == "Verify your email address before logging in."

        # =========================================================================
        # TEST 3: Submit valid 6-digit code via POST -> Expected: Verification succeeds
        # =========================================================================
        with SessionLocal() as db:
            from app.crud.user import create_verification_token_record
            raw_code = create_verification_token_record(db, user_db.user_id)

        verify_res = client.post("/auth/verify-email", json={"email": email, "code": raw_code})
        assert verify_res.status_code == 200
        assert "Email verified successfully" in verify_res.json()["message"]

        # =========================================================================
        # TEST 4: Check database -> Expected: email_verified = true
        # =========================================================================
        with SessionLocal() as db:
            updated_user = db.query(User).filter(User.email == email).first()
            assert updated_user.is_verified is True
            assert updated_user.email_verified is True

            token_in_db = (
                db.query(EmailVerificationToken)
                .filter(EmailVerificationToken.token_hash == hash_verification_token(raw_code))
                .first()
            )
            assert token_in_db.is_used is True

        # =========================================================================
        # TEST 5: Login using same email/password -> Expected: 200, JWT returned
        # =========================================================================
        login_verified_res = client.post(
            "/auth/login",
            data={"username": email, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert login_verified_res.status_code == 200
        login_data = login_verified_res.json()
        assert "access_token" in login_data
        assert login_data["token_type"] == "bearer"

        # =========================================================================
        # TEST 6: Submit code again -> Expected: "Email address is already verified."
        # =========================================================================
        reopen_res = client.post("/auth/verify-email", json={"email": email, "code": raw_code})
        assert reopen_res.status_code == 200
        assert reopen_res.json()["status"] == "already_verified"

        # =========================================================================
        # TEST 7: Use invalid code -> Expected: 400 "Invalid verification code."
        # =========================================================================
        client.post("/auth/signup", json={"full_name": "Invalid Tester", "email": unverified_temp_email, "password": password, "role": "Driver"})
        invalid_res = client.post("/auth/verify-email", json={"email": unverified_temp_email, "code": "000000"})
        assert invalid_res.status_code == 400
        assert "invalid" in invalid_res.json()["detail"].lower()

        # =========================================================================
        # TEST 8: Use expired code -> Expected: "Verification code has expired."
        # =========================================================================
        from app.core.security import generate_verification_code
        expired_raw_code = generate_verification_code()
        with SessionLocal() as db:
            expired_user = User(
                full_name="Expired Test User",
                email=expired_user_email,
                password="Password123!",
                role="Driver",
                is_verified=False,
            )
            db.add(expired_user)
            db.commit()
            db.refresh(expired_user)

            expired_token_record = EmailVerificationToken(
                user_id=expired_user.user_id,
                token_hash=hash_verification_token(expired_raw_code),
                expires_at=datetime.now(timezone.utc) - timedelta(minutes=30),
                is_used=False,
            )
            db.add(expired_token_record)
            db.commit()

        expired_res = client.post("/auth/verify-email", json={"email": expired_user_email, "code": expired_raw_code})
        assert expired_res.status_code == 400
        assert "expired" in expired_res.json()["detail"].lower()

        # =========================================================================
        # TEST 9: Resend verification -> Expected: safe response & new token
        # =========================================================================
        client.post(
            "/auth/signup",
            json={
                "full_name": "Resend Test User",
                "email": unverified_email,
                "password": password,
                "role": "Driver",
            },
        )

        with SessionLocal() as db:
            u_unverified = db.query(User).filter(User.email == unverified_email).first()
            db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == u_unverified.user_id).update(
                {"created_at": datetime.now(timezone.utc) - timedelta(minutes=5)}
            )
            db.commit()

        resend_res = client.post("/auth/resend-verification", json={"email": unverified_email})
        assert resend_res.status_code == 200
        assert len(resend_res.json()["message"]) > 0

        # =========================================================================
        # TEST 10: Wrong password -> Expected: 401 "Invalid email or password."
        # =========================================================================
        wrong_pwd_res = client.post(
            "/auth/login",
            data={"username": email, "password": "WrongPassword999!"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert wrong_pwd_res.status_code == 401
        assert wrong_pwd_res.json()["detail"] == "Invalid email or password."

        # =========================================================================
        # TEST 11: Non-existent email -> Expected: 401 "Invalid email or password."
        # =========================================================================
        wrong_email_res = client.post(
            "/auth/login",
            data={"username": "non_existent_email_12345@fleetflow.com", "password": "AnyPassword123!"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert wrong_email_res.status_code == 401
        assert wrong_email_res.json()["detail"] == "Invalid email or password."
    finally:
        # Teardown: Clean up test accounts from DB
        with SessionLocal() as db:
            from app.models.driver import Driver
            from app.models.attendance import Attendance
            from app.models.leave_request import LeaveRequest
            test_emails = [email, unverified_temp_email, expired_user_email, unverified_email]
            for em in test_emails:
                u = db.query(User).filter(User.email == em).first()
                if u:
                    drivers = db.query(Driver).filter(Driver.user_id == u.user_id).all()
                    for d in drivers:
                        db.query(Attendance).filter(Attendance.driver_id == d.driver_id).delete()
                        db.query(LeaveRequest).filter(LeaveRequest.driver_id == d.driver_id).delete()
                        db.delete(d)
                    db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == u.user_id).delete()
                    db.delete(u)
            db.commit()
