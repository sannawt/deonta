"""Send magic-link emails (SMTP or dev expose)."""

from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def app_base_url() -> str:
    return (os.environ.get("APP_BASE_URL") or "http://127.0.0.1:8001").rstrip("/")


def dev_expose_link() -> bool:
    return (os.environ.get("AUTH_DEV_EXPOSE_LINK") or "1").strip() in ("1", "true", "yes")


def build_verify_url(token: str) -> str:
    return f"{app_base_url()}/api/auth/verify?token={token}"


def send_magic_link_email(email: str, verify_url: str) -> None:
    from_addr = (os.environ.get("AUTH_FROM_EMAIL") or "noreply@compliancetwin.local").strip()
    host = (os.environ.get("SMTP_HOST") or "").strip()
    if not host:
        logger.info("Magic link for %s (no SMTP): %s", email, verify_url)
        return

    port = int((os.environ.get("SMTP_PORT") or "587").strip())
    user = (os.environ.get("SMTP_USER") or "").strip()
    password = (os.environ.get("SMTP_PASSWORD") or "").strip()
    use_tls = (os.environ.get("SMTP_USE_TLS") or "1").strip() in ("1", "true", "yes")

    msg = EmailMessage()
    msg["Subject"] = "Sign in to ComplianceTwin"
    msg["From"] = from_addr
    msg["To"] = email
    msg.set_content(
        f"Click the link below to sign in. This link expires in 15 minutes.\n\n{verify_url}\n"
    )

    with smtplib.SMTP(host, port, timeout=30) as smtp:
        if use_tls:
            smtp.starttls()
        if user and password:
            smtp.login(user, password)
        smtp.send_message(msg)
