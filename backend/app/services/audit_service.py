"""Admin audit log service.

Writes one row per privileged admin action so there is an accountability trail
for user management (role changes, status changes) and security events
(admin-initiated password resets).

The table is created on first use (CREATE TABLE IF NOT EXISTS) so no migration
script is required.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import text

from ..db.session import engine

logger = logging.getLogger(__name__)


def ensure_audit_log_table() -> None:
    """Create admin_audit_log table if it does not already exist."""
    sql = text("""
        CREATE TABLE IF NOT EXISTS admin_audit_log (
            id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
            admin_id    TEXT,
            admin_email TEXT,
            action      TEXT          NOT NULL,
            target_type TEXT,
            target_id   TEXT,
            detail      TEXT,
            ip_address  TEXT,
            created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
    """)
    try:
        with engine.begin() as conn:
            conn.execute(sql)
        logger.debug("admin_audit_log table ensured")
    except Exception:
        logger.exception("Could not ensure admin_audit_log table")


def log_admin_action(
    *,
    admin_id: Optional[str],
    admin_email: Optional[str],
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    detail: Optional[Dict[str, Any]] = None,
) -> None:
    """Append one row to admin_audit_log. Fails silently so it never breaks the
    main request — audit failure must not block the actual operation.

    Args:
        admin_id:    UUID of the acting admin.
        admin_email: Email of the acting admin (denormalised for readability).
        action:      Short verb describing the action, e.g. "role_changed".
        target_type: Entity type, e.g. "user".
        target_id:   ID of the entity that was affected.
        detail:      Free-form dict with before/after values or other context.
    """
    try:
        from flask import request as _req
        ip = _req.remote_addr
    except RuntimeError:
        ip = None

    try:
        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO admin_audit_log
                        (id, admin_id, admin_email, action,
                         target_type, target_id, detail, ip_address, created_at)
                    VALUES
                        (:id, :admin_id, :admin_email, :action,
                         :target_type, :target_id, :detail, :ip_address, :now)
                """),
                {
                    "id":          str(uuid.uuid4()),
                    "admin_id":    str(admin_id) if admin_id else None,
                    "admin_email": admin_email,
                    "action":      action,
                    "target_type": target_type,
                    "target_id":   str(target_id) if target_id else None,
                    "detail":      json.dumps(detail, ensure_ascii=False) if detail else None,
                    "ip_address":  ip,
                    "now":         datetime.now(timezone.utc),
                },
            )
    except Exception:
        logger.exception(
            "audit log write failed: action=%s target=%s/%s",
            action, target_type, target_id,
        )
