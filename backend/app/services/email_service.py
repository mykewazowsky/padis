import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


class EmailConfigurationError(RuntimeError):
    pass


def _get_required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise EmailConfigurationError(f"{name} belum dikonfigurasi")
    return value


def _build_reset_email_html(reset_link: str, expiry_minutes: int = 30) -> str:
    return f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Password PADIS</title>
</head>
<body style="margin:0;padding:0;background-color:#eef4fb;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
    style="background-color:#eef4fb;padding:44px 16px 56px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
          style="max-width:540px;width:100%;">

          <!-- Brand header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color:#1e63b5;border-radius:12px;padding:9px 22px;">
                    <span style="font-size:17px;font-weight:800;letter-spacing:0.08em;
                      color:#ffffff;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
                      PADIS
                    </span>
                  </td>
                </tr>
              </table>
              <p style="margin:10px 0 0;font-size:11px;color:#64748b;letter-spacing:0.05em;
                text-transform:uppercase;font-weight:600;">
                Platform Analisis Dampak &amp; Risiko Bencana
              </p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:20px;
              box-shadow:0 6px 32px rgba(15,23,42,0.09);overflow:hidden;">

              <!-- Top accent stripe -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="height:5px;background:linear-gradient(90deg,#1e63b5 0%,#2d8bef 60%,#174f92 100%);"></td>
                </tr>
              </table>

              <!-- Card content -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:38px 36px 12px;">

                    <!-- Icon badge -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                      style="margin-bottom:22px;">
                      <tr>
                        <td style="background-color:#eaf2ff;border-radius:50%;
                          width:56px;height:56px;text-align:center;vertical-align:middle;">
                          <span style="font-size:26px;line-height:56px;">🔐</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Heading -->
                    <h1 style="margin:0 0 10px;font-size:22px;font-weight:800;
                      color:#0f172a;line-height:1.35;
                      font-family:'Segoe UI',Roboto,Arial,sans-serif;">
                      Reset Password Akun PADIS
                    </h1>
                    <p style="margin:0 0 28px;font-size:14px;color:#475569;line-height:1.75;">
                      Halo! Kami menerima permintaan untuk mereset password akun PADIS Anda.
                      Klik tombol di bawah untuk melanjutkan proses pembuatan password baru.
                    </p>

                    <!-- CTA Button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                      style="margin-bottom:24px;">
                      <tr>
                        <td style="background-color:#1e63b5;border-radius:12px;
                          box-shadow:0 4px 14px rgba(30,99,181,0.35);">
                          <a href="{reset_link}" target="_blank"
                            style="display:inline-block;padding:15px 36px;
                              font-size:14px;font-weight:700;color:#ffffff;
                              text-decoration:none;letter-spacing:0.03em;
                              font-family:'Segoe UI',Roboto,Arial,sans-serif;">
                            Reset Password Sekarang &nbsp;→
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Link fallback -->
                    <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;text-align:center;">
                      Tombol tidak berfungsi? Salin tautan ini ke browser Anda:
                    </p>
                    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;
                      border-radius:8px;padding:11px 14px;margin-bottom:32px;">
                      <p style="margin:0;font-size:11px;color:#475569;
                        word-break:break-all;font-family:'Courier New',Courier,monospace;
                        line-height:1.6;">
                        {reset_link}
                      </p>
                    </div>

                  </td>
                </tr>
              </table>

              <!-- Security notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:0 36px 36px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background-color:#fffbeb;border:1px solid #fde68a;
                          border-radius:12px;padding:16px 18px;">
                          <p style="margin:0 0 8px;font-size:11px;font-weight:700;
                            color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">
                            ⚠&nbsp; Informasi Keamanan
                          </p>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="font-size:13px;color:#78350f;line-height:1.9;
                                padding-left:4px;">
                                &bull;&nbsp; Tautan berlaku selama
                                <strong>{expiry_minutes} menit</strong>
                                sejak email ini dikirim<br/>
                                &bull;&nbsp; Tautan hanya dapat digunakan
                                <strong>satu kali</strong><br/>
                                &bull;&nbsp; Abaikan email ini jika Anda tidak
                                meminta reset password
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Bottom separator -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-top:1px solid #f1f5f9;padding:20px 36px 24px;">
                    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;text-align:center;">
                      Jika Anda tidak meminta reset password, tidak ada tindakan yang
                      diperlukan — akun Anda tetap aman.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0 0 5px;font-size:12px;color:#94a3b8;line-height:1.6;">
                Email ini dikirim oleh sistem PADIS secara otomatis.<br/>
                Mohon jangan membalas email ini.
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#cbd5e1;">
                &copy; 2026 PADIS &mdash; Geodesi &amp; Geomatika ITB
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _build_reset_email_text(reset_link: str, expiry_minutes: int = 30) -> str:
    separator = "=" * 48
    return "\n".join([
        "PADIS — Reset Password Akun",
        separator,
        "",
        "Halo,",
        "",
        "Kami menerima permintaan untuk mereset password akun PADIS Anda.",
        "Buka tautan berikut untuk membuat password baru:",
        "",
        f"  {reset_link}",
        "",
        separator,
        "Informasi Keamanan:",
        f"  • Tautan berlaku selama {expiry_minutes} menit sejak email ini dikirim",
        "  • Tautan hanya dapat digunakan satu kali",
        "  • Abaikan email ini jika Anda tidak meminta reset password",
        separator,
        "",
        "Email ini dikirim oleh sistem PADIS secara otomatis.",
        "Mohon jangan membalas email ini.",
        "",
        "© 2026 PADIS — Geodesi & Geomatika ITB",
    ])


def send_password_reset_email(
    to_email: str,
    reset_link: str,
    expiry_minutes: int = 30,
) -> None:
    smtp_host = _get_required_env("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_username).strip()
    from_name = os.getenv("SMTP_FROM_NAME", "PADIS").strip()
    use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() not in {
        "0", "false", "no",
    }

    if not from_email:
        raise EmailConfigurationError(
            "SMTP_FROM_EMAIL atau SMTP_USERNAME belum dikonfigurasi"
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset Password Akun PADIS"
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    msg["X-Mailer"] = "PADIS Mailer"

    # Plain text first, HTML second — clients prefer the last attachment
    msg.attach(MIMEText(
        _build_reset_email_text(reset_link, expiry_minutes),
        "plain",
        "utf-8",
    ))
    msg.attach(MIMEText(
        _build_reset_email_html(reset_link, expiry_minutes),
        "html",
        "utf-8",
    ))

    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as smtp:
        if use_tls:
            smtp.starttls()
        if smtp_username and smtp_password:
            smtp.login(smtp_username, smtp_password)
        smtp.send_message(msg)

    logger.info("Password reset email sent to %s", to_email)
