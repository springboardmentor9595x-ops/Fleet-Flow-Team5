"""
FleetFlow Email Service
Handles SMTP dispatch, background email sending, and email audit logging.
"""
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional
from app.config import settings

# In-memory email audit log (shared across the application)
_email_log: List[dict] = []
_log_counter = 0


def append_email_log(
    recipient: str,
    recipient_name: str,
    role: str,
    subject: str,
    body_preview: str,
    added_by_admin: bool = False,
    status: str = "Sent",
):
    global _log_counter
    _log_counter += 1
    _email_log.append({
        "id": _log_counter,
        "recipient": recipient,
        "recipient_name": recipient_name,
        "role": role,
        "subject": subject,
        "body_preview": body_preview,
        "status": status,
        "added_by_admin": added_by_admin,
        "sent_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
    })


def get_email_logs() -> List[dict]:
    return list(reversed(_email_log))


def send_notification_email(
    recipient_email: str,
    recipient_name: str,
    role: str,
    title: str,
    message: str,
    notification_type: str = "SYSTEM_NOTIFICATION",
):
    """Dispatches a notification email via SMTP and records in email logs."""
    subject = f"FleetFlow Alert — {title}"
    body_text = (
        f"Hello {recipient_name},\n\n"
        f"You have a new FleetFlow system notification:\n\n"
        f"Title: {title}\n"
        f"Message: {message}\n"
        f"Timestamp: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n\n"
        f"Log in to FleetFlow to view details: http://localhost:5173\n\n"
        f"— FleetFlow Logistics Team"
    )

    body_html = f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 16px; background-color: #ffffff;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid #F1F5F9; padding-bottom: 16px;">
        <div style="background: #0D9488; color: white; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold;">FF</div>
        <div>
          <h2 style="color: #0F172A; margin: 0; font-size: 16px; font-weight: 800;">FleetFlow Logistics</h2>
          <p style="color: #64748B; font-size: 11px; margin: 2px 0 0;">Automated System Notification</p>
        </div>
      </div>
      <p style="color: #334155; font-size: 14px;">Hello <strong>{recipient_name}</strong> ({role}),</p>
      <div style="background: #F8FAFC; border-left: 4px solid #0D9488; border-radius: 6px; padding: 14px 18px; margin: 18px 0;">
        <h4 style="margin: 0 0 6px; color: #0F172A; font-size: 14px;">{title}</h4>
        <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.5;">{message}</p>
      </div>
      <p style="color: #64748B; font-size: 12px;">
        Please log into the FleetFlow portal to take appropriate action if required.
      </p>
      <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
      <p style="color: #94A3B8; font-size: 11px; text-align: center; margin: 0;">
        FleetFlow Intelligent Fleet Management System • Sent automatically
      </p>
    </div>
    """

    append_email_log(
        recipient=recipient_email,
        recipient_name=recipient_name,
        role=role,
        subject=subject,
        body_preview=f"{title}: {message[:80]}...",
        added_by_admin=False,
        status="Sent",
    )

    def _deliver():
        try:
            smtp_host = getattr(settings, "SMTP_HOST", "smtp.gmail.com")
            smtp_port = int(getattr(settings, "SMTP_PORT", 587))
            smtp_user = getattr(settings, "SMTP_USER", "")
            smtp_pass = getattr(settings, "SMTP_PASSWORD", "")

            if smtp_user and smtp_pass:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = getattr(settings, "EMAILS_FROM", "noreply@fleetflow.com")
                msg["To"] = recipient_email
                msg.attach(MIMEText(body_text, "plain"))
                msg.attach(MIMEText(body_html, "html"))

                with smtplib.SMTP(smtp_host, smtp_port, timeout=4) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(msg["From"], [recipient_email], msg.as_string())
        except Exception as exc:
            print(f"[NOTIFICATION EMAIL] SMTP dispatch background error: {exc}")

    import threading
    t = threading.Thread(target=_deliver, daemon=True)
    t.start()

