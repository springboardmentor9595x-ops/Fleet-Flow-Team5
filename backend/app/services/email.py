import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Tuple

from app.config import settings

logger = logging.getLogger("fleetflow.email")


def send_verification_email(to_email: str, raw_token: str, full_name: str | None = None) -> Tuple[bool, str]:
    """
    Send an email verification message to a user.
    If SMTP credentials are not configured or email sending fails in development,
    it logs the link gracefully rather than crashing.
    
    Returns (success: bool, status_message: str)
    """
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={raw_token}"
    display_name = full_name or "FleetFlow User"

    subject = "Verify your FleetFlow account"
    
    # Plain text version
    text_content = f"""Hello {display_name},

Thank you for registering with FleetFlow.

Please verify your email address by clicking the link below:
{verification_url}

This verification link will expire in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours.

If you did not create a FleetFlow account, please disregard this message.

Best regards,
FleetFlow Logistics Team
"""

    # Modern HTML version
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your FleetFlow account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" style="max-width: 560px; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 40px; text-align: left; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <tr>
            <td>
              <div style="display: flex; align-items: center; margin-bottom: 24px;">
                <span style="font-size: 24px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px;">FleetFlow</span>
              </div>
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Verify your email address</h1>
              <p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                Hello <strong style="color: #f1f5f9;">{display_name}</strong>,<br><br>
                Thank you for creating an account with FleetFlow. To activate your account and access your fleet dashboard, please verify your email address.
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="{verification_url}" style="background: linear-space, #2563eb; background: linear-gradient(135deg, #2563eb, #3b82f6); color: #ffffff; text-decoration: none; padding: 14px 32px; font-size: 15px; font-weight: 600; border-radius: 8px; display: inline-block; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                  Verify Email Address
                </a>
              </div>

              <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
                This link will expire in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours. If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="word-break: break-all; color: #38bdf8; font-size: 13px; margin: 0 0 24px 0;">
                <a href="{verification_url}" style="color: #38bdf8; text-decoration: underline;">{verification_url}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;" />

              <p style="color: #64748b; font-size: 12px; margin: 0;">
                If you did not register for a FleetFlow account, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    # If SMTP is not configured, gracefully log for development
    if not settings.SMTP_HOST:
        print("\n" + "=" * 80)
        print(f"[DEVELOPMENT EMAIL DISPATCH] (SMTP_HOST not configured)")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Verification URL: {verification_url}")
        print("=" * 80 + "\n")
        logger.info(f"Dev mode: Verification email link for {to_email}: {verification_url}")
        return True, "Development mode: verification link logged"

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = to_email

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Connect to SMTP server
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        if settings.SMTP_USE_TLS:
            server.starttls()

        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)

        server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        server.quit()
        logger.info(f"Verification email successfully sent via SMTP to {to_email}")
        return True, "Email sent successfully"

    except Exception as e:
        logger.error(f"Failed to send verification email via SMTP to {to_email}: {e}")
        # Log to console so development is never blocked
        print("\n" + "!" * 80)
        print(f"[SMTP SEND ERROR - FALLBACK LOGGING]")
        print(f"To: {to_email}")
        print(f"Error: {e}")
        print(f"Verification URL: {verification_url}")
        print("!" * 80 + "\n")
        return False, f"SMTP delivery failed: {str(e)}"
