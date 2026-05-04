import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)


class EmailConfigurationError(RuntimeError):
    pass


def _get_required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise EmailConfigurationError(f"{name} belum dikonfigurasi")
    return value


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    smtp_host = _get_required_env("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_username).strip()
    from_name = os.getenv("SMTP_FROM_NAME", "PADIS").strip()
    use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() not in {
        "0",
        "false",
        "no",
    }

    if not from_email:
        raise EmailConfigurationError("SMTP_FROM_EMAIL atau SMTP_USERNAME belum dikonfigurasi")

    message = EmailMessage()
    message["Subject"] = "Reset password akun PADIS"
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                "Halo,",
                "",
                "Kami menerima permintaan reset password untuk akun PADIS Anda.",
                "Buka tautan berikut untuk membuat password baru:",
                reset_link,
                "",
                "Tautan ini berlaku selama 30 menit. Abaikan email ini jika Anda tidak meminta reset password.",
                "",
                "PADIS",
            ]
        )
    )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as smtp:
        if use_tls:
            smtp.starttls()
        if smtp_username and smtp_password:
            smtp.login(smtp_username, smtp_password)
        smtp.send_message(message)

    logger.info("Password reset email sent")
