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


def send_role_change_email(
    recipient_email: str,
    recipient_name: str,
    old_role: str,
    new_role: str,
    admin_name: str = "FleetFlow Administrator",
    reason: Optional[str] = None,
):
    """
    Sends an official role change notification email to the user when an admin modifies their role.
    Records the email in the audit log and dispatches via SMTP in the background.
    """
    subject = f"FleetFlow — Role Updated to {new_role}"
    
    role_descriptions = {
        "Admin": "Full administrative control, user RBAC governance, executive analytics, and system audit logs.",
        "FleetManager": "Fleet asset management, vehicle assignments, maintenance scheduling, and fuel expense monitoring.",
        "Dispatcher": "Live GPS dispatch tracking, smart route optimization, trip scheduling, and shipment lifecycle management.",
        "Driver": "Driver Command Center access, active delivery manifests, trip navigation, and attendance tracking.",
    }
    
    new_role_desc = role_descriptions.get(new_role, "Access to role-specific operations in the FleetFlow Logistics Portal.")
    reason_section_txt = f"\nAdministrative Reason / Note:\n  {reason}\n" if reason else ""
    reason_section_html = f"""
    <div style="background: rgba(217,119,6,0.06); border-left: 3px solid #D97706; padding: 10px 14px; border-radius: 6px; margin: 12px 0;">
      <p style="margin: 0; font-size: 12px; color: #B45309;">
        <strong>Admin Remarks:</strong> {reason}
      </p>
    </div>
    """ if reason else ""

    body_text = (
        f"Hello {recipient_name},\n\n"
        f"Your role on the FleetFlow Intelligent Logistics Platform has been updated by {admin_name}.\n\n"
        f"  Previous Role: {old_role}\n"
        f"  New Role:      {new_role}\n"
        f"{reason_section_txt}\n"
        f"Role Permissions Overview:\n"
        f"{new_role_desc}\n\n"
        f"Please log in or refresh your active session at http://localhost:5173 to access your new role privileges.\n\n"
        f"If you believe this change was made in error, please contact your FleetFlow system administrator.\n\n"
        f"— FleetFlow Administration & Security Team"
    )

    body_html = f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; border: 1px solid #E2E8F0; border-radius: 18px; background-color: #ffffff; color: #0F172A;">
      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 24px; border-bottom: 1px solid #F1F5F9; padding-bottom: 18px;">
        <div style="background: linear-gradient(135deg, #D97706, #B45309); color: white; width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; box-shadow: 0 4px 12px rgba(217,119,6,0.25);">
          FF
        </div>
        <div>
          <h2 style="color: #0F172A; margin: 0; font-size: 17px; font-weight: 800;">FleetFlow Role Governance</h2>
          <p style="color: #64748B; font-size: 12px; margin: 2px 0 0;">Account Privileges Updated</p>
        </div>
      </div>

      <p style="color: #334155; font-size: 14px; margin: 0 0 16px;">Hello <strong>{recipient_name}</strong>,</p>
      
      <p style="color: #475569; font-size: 13px; line-height: 1.6; margin: 0 0 20px;">
        Your system role and permissions on <strong>FleetFlow Logistics</strong> have been updated by an administrator.
      </p>

      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <span style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Previous Role</span>
            <p style="margin: 2px 0 0; font-size: 14px; font-weight: 700; color: #64748B;">{old_role}</p>
          </div>
          <span style="font-size: 18px; color: #0D9488; font-weight: 800;">➔</span>
          <div style="text-align: right;">
            <span style="font-size: 11px; font-weight: 700; color: #0D9488; text-transform: uppercase;">New Assigned Role</span>
            <p style="margin: 2px 0 0; font-size: 15px; font-weight: 800; color: #0D9488;">{new_role}</p>
          </div>
        </div>
        {reason_section_html}
        <div style="border-top: 1px dashed #CBD5E1; padding-top: 12px; margin-top: 8px;">
          <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">
            <strong>Permissions:</strong> {new_role_desc}
          </p>
        </div>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="http://localhost:5173" style="display: inline-block; background: #0D9488; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(13,148,136,0.25);">
          Log In to FleetFlow Portal
        </a>
      </div>

      <p style="color: #64748B; font-size: 12px; line-height: 1.5; margin: 0 0 16px;">
        If your active session is still open, please sign out and sign back in to refresh your access token and permissions.
      </p>

      <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
      <p style="color: #94A3B8; font-size: 11px; text-align: center; margin: 0;">
        FleetFlow Intelligent Logistics Platform • Security and RBAC Governance
      </p>
    </div>
    """

    body_preview = f"Role updated from {old_role} to {new_role} by Admin. {f'Note: {reason}' if reason else ''}"

    append_email_log(
        recipient=recipient_email,
        recipient_name=recipient_name,
        role=new_role,
        subject=subject,
        body_preview=body_preview,
        added_by_admin=True,
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
            print(f"[ROLE CHANGE EMAIL] SMTP dispatch error for {recipient_email}: {exc}")

    import threading
    t = threading.Thread(target=_deliver, daemon=True)
    t.start()


def send_account_deletion_email(
    recipient_email: str,
    recipient_name: str,
    admin_name: str = "FleetFlow Administrator",
    reason: Optional[str] = None,
):
    """
    Sends an account closure / termination notification email when an administrator deletes a user account.
    """
    subject = "FleetFlow — Account Decommission Notice"
    reason_txt = f"\nReason for deletion: {reason}\n" if reason else ""
    reason_html = f"""
    <div style="background: rgba(220,38,38,0.06); border-left: 3px solid #DC2626; padding: 10px 14px; border-radius: 6px; margin: 12px 0;">
      <p style="margin: 0; font-size: 12px; color: #B91C1C;">
        <strong>Reason:</strong> {reason}
      </p>
    </div>
    """ if reason else ""

    body_text = (
        f"Hello {recipient_name},\n\n"
        f"Your account access on FleetFlow Intelligent Logistics Platform has been terminated by {admin_name}.{reason_txt}\n"
        f"All assigned permissions and vehicle/trip assignments have been cleared.\n\n"
        f"If you believe this action was performed in error, please contact your organization administrator.\n\n"
        f"— FleetFlow Administration & Security Team"
    )

    body_html = f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; border: 1px solid #E2E8F0; border-radius: 18px; background-color: #ffffff; color: #0F172A;">
      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 24px; border-bottom: 1px solid #F1F5F9; padding-bottom: 18px;">
        <div style="background: #DC2626; color: white; width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; box-shadow: 0 4px 12px rgba(220,38,38,0.25);">
          FF
        </div>
        <div>
          <h2 style="color: #0F172A; margin: 0; font-size: 17px; font-weight: 800;">FleetFlow Account Governance</h2>
          <p style="color: #64748B; font-size: 12px; margin: 2px 0 0;">Account Decommission Notice</p>
        </div>
      </div>

      <p style="color: #334155; font-size: 14px; margin: 0 0 16px;">Hello <strong>{recipient_name}</strong>,</p>
      
      <p style="color: #475569; font-size: 13px; line-height: 1.6; margin: 0 0 20px;">
        This is an official notification that your account credentials and system privileges on <strong>FleetFlow Logistics</strong> have been removed by an administrator.
      </p>

      {reason_html}

      <p style="color: #64748B; font-size: 12px; line-height: 1.5; margin: 16px 0;">
        If you have ongoing deliveries or questions regarding this account closure, please reach out to your fleet administrator.
      </p>

      <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
      <p style="color: #94A3B8; font-size: 11px; text-align: center; margin: 0;">
        FleetFlow Intelligent Logistics Platform • Security and Identity Management
      </p>
    </div>
    """

    body_preview = f"Account access on FleetFlow has been terminated by Admin. {f'Reason: {reason}' if reason else ''}"

    append_email_log(
        recipient=recipient_email,
        recipient_name=recipient_name,
        role="User",
        subject=subject,
        body_preview=body_preview,
        added_by_admin=True,
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
            print(f"[ACCOUNT DELETION EMAIL] SMTP dispatch error for {recipient_email}: {exc}")

    import threading
    t = threading.Thread(target=_deliver, daemon=True)
    t.start()



