import email.utils
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Tuple

from app.config import settings

logger = logging.getLogger("fleetflow.email")


def _mask_email(email: str | None) -> str:
    if not email or "@" not in email:
        return "***"
    parts = email.split("@")
    name = parts[0]
    masked_name = name[0] + "***" if len(name) > 1 else "***"
    return f"{masked_name}@{parts[1]}"


def _send_email_smtp(to_email: str, subject: str, text_content: str, html_content: str) -> Tuple[bool, str]:
    if not settings.SMTP_HOST:
        logger.error(f"[SMTP] Host is not configured (SMTP_HOST is None or empty). Cannot send email to {_mask_email(to_email)}.")
        return False, "Unable to send email. SMTP_HOST is not configured in backend/.env."

    masked_dest = _mask_email(to_email)
    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    use_tls = settings.SMTP_USE_TLS

    # Enforce FROM address consistency with SMTP username when using Gmail SMTP
    from_name = getattr(settings, "SMTP_FROM_NAME", "FleetFlow") or "FleetFlow"
    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME or "noreply@fleetflow.com"
    if settings.SMTP_USERNAME and "@gmail.com" in settings.SMTP_USERNAME.lower():
        from_email = settings.SMTP_USERNAME.strip()

    try:
        msg_id = email.utils.make_msgid(domain="fleetflow.com")
        date_header = email.utils.formatdate(localtime=True)

        logger.info(f"[EMAIL TRACE] Recipient: {masked_dest}")
        logger.info(f"[EMAIL TRACE] From: {_mask_email(from_email)}")
        logger.info(f"[EMAIL TRACE] SMTP host: {host}:{port}")
        logger.info(f"[EMAIL TRACE] Message-ID: {msg_id}")

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email.strip()
        msg["Reply-To"] = from_email
        msg["Date"] = date_header
        msg["Message-ID"] = msg_id

        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        logger.info(f"[SMTP] Step 1/2: Connecting TCP to {host}:{port}...")
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=10)
        else:
            server = smtplib.SMTP(host, port, timeout=10)
            if use_tls:
                logger.info(f"[SMTP] Step 3/4: EHLO & STARTTLS...")
                server.ehlo()
                server.starttls()
                server.ehlo()
                logger.info(f"[SMTP] STARTTLS successful.")

        logger.info(f"[SMTP] Connection established with {host}:{port}.")

        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            logger.info(f"[SMTP] Step 5/6: Authenticating as {_mask_email(settings.SMTP_USERNAME)}...")
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            logger.info(f"[SMTP] Authentication successful.")

        logger.info(f"[SMTP] Step 7/8/9 (MAIL FROM / RCPT TO / DATA): Sending message to: {masked_dest}...")
        refused_dict = server.sendmail(from_email, [to_email.strip()], msg.as_string())
        if refused_dict:
            logger.error(f"[SMTP Failure] Refused recipients for message {msg_id}: {refused_dict}")
            server.quit()
            return False, f"SMTP Refused Recipients: {refused_dict}"

        logger.info(f"[SMTP] Step 10: Message accepted by SMTP server for recipient: {masked_dest} (Message-ID: {msg_id}).")

        server.quit()
        logger.info(f"[SMTP] Connection closed cleanly.")
        return True, "Email accepted by SMTP server"
    except smtplib.SMTPAuthenticationError as e:
        err_msg = e.smtp_error.decode('utf-8', errors='ignore') if isinstance(e.smtp_error, bytes) else str(e.smtp_error)
        logger.error(f"[SMTP Failure] Authentication failed for host {host}:{port}: {e.smtp_code} {err_msg}")
        return False, f"SMTP Authentication Error ({e.smtp_code}): {err_msg}"
    except smtplib.SMTPConnectError as e:
        logger.error(f"[SMTP Failure] Connection failed to {host}:{port}: {e}")
        return False, f"SMTP Connection Error: {e}"
    except smtplib.SMTPException as e:
        logger.error(f"[SMTP Failure] Protocol error for host {host}:{port}: {e}")
        return False, f"SMTP Protocol Error: {e}"
    except Exception as e:
        logger.error(f"[SMTP Failure] Unexpected error sending email to {masked_dest}: {e}")
        return False, f"SMTP Error: {e}"




def send_verification_email(to_email: str, code: str, full_name: str | None = None) -> Tuple[bool, str]:
    """
    Send a 6-digit email verification code to a user via SMTP.
    Verification codes are strictly kept secret and NEVER logged to console/files.
    """
    display_name = full_name or "FleetFlow User"
    formatted_code = str(code).strip()
    subject = "FleetFlow - Verify Your Email"

    text_content = f"""Hello {display_name},

Thank you for registering with FleetFlow.

Your 6-digit email verification code is: {formatted_code}

This code will expire in {settings.EMAIL_VERIFICATION_EXPIRE_MINUTES} minutes.
Do not share this verification code with anyone.

Enter this code on the verification screen to activate your account.

If you did not create a FleetFlow account, please disregard this message.

Best regards,
FleetFlow Logistics Team
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FleetFlow - Verify Your Email</title>
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
                Please use the following 6-digit verification code to activate your FleetFlow account:
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <div style="background: #0f172a; border: 2px dashed #38bdf8; border-radius: 12px; padding: 20px 32px; display: inline-block;">
                  <span style="font-size: 36px; font-weight: 800; color: #38bdf8; letter-spacing: 10px;">{formatted_code}</span>
                </div>
              </div>

              <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0; text-align: center;">
                This code will expire in <strong style="color: #cbd5e1;">{settings.EMAIL_VERIFICATION_EXPIRE_MINUTES} minutes</strong>.<br>
                For security reasons, do not share this code with anyone.
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

    return _send_email_smtp(to_email, subject, text_content, html_content)


def send_leave_approval_email(
    to_email: str,
    driver_name: str,
    leave_type: str,
    start_date: str,
    end_date: str,
    days_count: int,
    reviewer_name: str,
    review_date: str,
) -> Tuple[bool, str]:
    """
    Send an email notification to driver when their leave request is APPROVED.
    """
    display_name = driver_name or "Driver"
    subject = "FleetFlow - Leave Request Approved"

    text_content = f"""Hello {display_name},

Your leave request has been APPROVED.

Details:
- Leave Type: {leave_type}
- Start Date: {start_date}
- End Date: {end_date}
- Duration: {days_count} Day(s)
- Status: APPROVED
- Reviewed By: {reviewer_name}
- Approval Date: {review_date}

Your attendance calendar has been updated accordingly.

Best regards,
FleetFlow Operations Team
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FleetFlow - Leave Request Approved</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" style="max-width: 560px; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 40px; text-align: left;">
          <tr>
            <td>
              <div style="margin-bottom: 24px;">
                <span style="font-size: 24px; font-weight: 800; color: #38bdf8;">FleetFlow</span>
              </div>
              <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
                <span style="color: #34d399; font-weight: 700; font-size: 16px;">LEAVE REQUEST APPROVED</span>
              </div>
              <p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                Hello <strong style="color: #f1f5f9;">{display_name}</strong>,<br><br>
                Your leave application has been reviewed and approved by management.
              </p>
              
              <table width="100%" style="background: #0f172a; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 24px; color: #e2e8f0; font-size: 14px;">
                <tr><td style="padding: 6px 0; color: #94a3b8;">Leave Type:</td><td style="font-weight: 600;">{leave_type}</td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8;">Period:</td><td style="font-weight: 600;">{start_date} to {end_date} ({days_count} Days)</td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8;">Status:</td><td style="color: #34d399; font-weight: 700;">APPROVED</td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8;">Approved By:</td><td style="font-weight: 600;">{reviewer_name}</td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8;">Approval Date:</td><td style="font-weight: 600;">{review_date}</td></tr>
              </table>

              <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
                Your fleet attendance record has been updated to reflect Approved Leave for these dates.
              </p>

              <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;" />
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                FleetFlow Automated Logistics Management System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return _send_email_smtp(to_email, subject, text_content, html_content)


def send_leave_rejection_email(
    to_email: str,
    driver_name: str,
    leave_type: str,
    start_date: str,
    end_date: str,
    days_count: int,
    rejection_reason: str,
    reviewer_name: str,
    review_date: str,
) -> Tuple[bool, str]:
    """
    Send an email notification to driver when their leave request is REJECTED.
    """
    display_name = driver_name or "Driver"
    subject = "FleetFlow - Leave Request Rejected"
    reason_str = rejection_reason or "No rejection reason provided."

    text_content = f"""Hello {display_name},

Your leave request has been REJECTED.

Details:
- Leave Type: {leave_type}
- Start Date: {start_date}
- End Date: {end_date}
- Duration: {days_count} Day(s)
- Status: REJECTED
- Rejection Reason: {reason_str}
- Reviewed By: {reviewer_name}
- Rejection Date: {review_date}

If you have questions regarding this decision, please contact management.

Best regards,
FleetFlow Operations Team
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FleetFlow - Leave Request Rejected</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" style="max-width: 560px; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 40px; text-align: left;">
          <tr>
            <td>
              <div style="margin-bottom: 24px;">
                <span style="font-size: 24px; font-weight: 800; color: #38bdf8;">FleetFlow</span>
              </div>
              <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
                <span style="color: #f87171; font-weight: 700; font-size: 16px;">LEAVE REQUEST REJECTED</span>
              </div>
              <p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                Hello <strong style="color: #f1f5f9;">{display_name}</strong>,<br><br>
                Your leave application has been reviewed and was not approved.
              </p>
              
              <table width="100%" style="background: #0f172a; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 24px; color: #e2e8f0; font-size: 14px;">
                <tr><td style="padding: 6px 0; color: #94a3b8;">Leave Type:</td><td style="font-weight: 600;">{leave_type}</td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8;">Period:</td><td style="font-weight: 600;">{start_date} to {end_date} ({days_count} Days)</td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8;">Status:</td><td style="color: #f87171; font-weight: 700;">REJECTED</td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8;">Reason:</td><td style="color: #f87171; font-weight: 600;">{reason_str}</td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8;">Reviewed By:</td><td style="font-weight: 600;">{reviewer_name}</td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8;">Rejection Date:</td><td style="font-weight: 600;">{review_date}</td></tr>
              </table>

              <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
                If you need to discuss this decision, please reach out to your Fleet Manager.
              </p>

              <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;" />
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                FleetFlow Automated Logistics Management System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return _send_email_smtp(to_email, subject, text_content, html_content)


def send_role_change_email(
    to_email: str,
    user_name: str,
    previous_role: str,
    new_role: str,
    changed_by_name: str,
    change_date: str,
) -> Tuple[bool, str]:
    """
    Send an email notification to user when their role is changed by an admin.
    """
    display_name = user_name or "User"
    subject = "FleetFlow - Your Role Has Changed"

    text_content = f"""Hello {display_name},

Your FleetFlow account role has been changed.

Previous role: {previous_role}
New role: {new_role}
Changed by: {changed_by_name}
Changed on: {change_date}

If you did not expect this change, please contact your FleetFlow administrator.

Best regards,
FleetFlow Operations Team
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FleetFlow - Your Role Has Changed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" style="max-width: 560px; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 40px; text-align: left;">
          <tr>
            <td>
              <div style="margin-bottom: 24px;">
                <span style="font-size: 24px; font-weight: 800; color: #38bdf8;">FleetFlow</span>
              </div>
              <div style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
                <span style="color: #38bdf8; font-weight: 700; font-size: 16px;">ACCOUNT ROLE CHANGED</span>
              </div>
              <p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                Hello <strong style="color: #f1f5f9;">{display_name}</strong>,<br><br>
                Your FleetFlow account access role has been updated by an administrator.
              </p>
              
              <table width="100%" style="background: #0f172a; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 24px; color: #e2e8f0; font-size: 14px;">
                <tr><td style="padding: 6px 0; color: #94a3b8;">Previous Role:</td><td style="font-weight: 600; color: #cbd5e1;">{previous_role}</td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8;">New Role:</td><td style="font-weight: 700; color: #38bdf8;">{new_role}</td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8;">Changed By:</td><td style="font-weight: 600;">{changed_by_name}</td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8;">Changed On:</td><td style="font-weight: 600;">{change_date}</td></tr>
              </table>

              <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
                If you did not expect this change, please contact your FleetFlow administrator immediately.
              </p>

              <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;" />
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                FleetFlow Automated Logistics Management System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return _send_email_smtp(to_email, subject, text_content, html_content)



