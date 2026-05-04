from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import logging
import uuid

from sqlalchemy import text

from ...db.session import engine

logger = logging.getLogger(__name__)


def _row_to_user_dict(row) -> Dict[str, Any]:
    return {
        "id": str(row.id),  # UUID → str (safe for JWT + JSON)
        "name": row.name,
        "email": row.email,
        "password_hash": row.password_hash,
        "role": row.role,
        "status": row.status,
        "is_active": row.is_active,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "last_login_at": row.last_login_at.isoformat() if row.last_login_at else None,
    }


def _row_to_reset_token_dict(row) -> Dict[str, Any]:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "token": row.token_hash,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
        "used_at": row.used_at.isoformat() if row.used_at else None,
    }


def list_users() -> list[Dict[str, Any]]:
    sql = text("""
        select
            id,
            name,
            email,
            password_hash,
            role,
            status,
            is_active,
            created_at,
            updated_at,
            last_login_at
        from app_users
        order by created_at desc
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql).mappings().all()

    return [_row_to_user_dict(row) for row in rows]


def find_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    email_norm = email.strip().lower()

    sql = text("""
        select
            id,
            name,
            email,
            password_hash,
            role,
            status,
            is_active,
            created_at,
            updated_at,
            last_login_at
        from app_users
        where lower(email) = :email
        limit 1
    """)

    with engine.connect() as conn:
        row = conn.execute(sql, {"email": email_norm}).mappings().first()

    return _row_to_user_dict(row) if row else None


def find_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    # Cast string → uuid.UUID so psycopg2 sends the correct PostgreSQL type
    try:
        user_uuid = uuid.UUID(str(user_id))
    except (ValueError, AttributeError):
        return None

    sql = text("""
        select
            id,
            name,
            email,
            password_hash,
            role,
            status,
            is_active,
            created_at,
            updated_at,
            last_login_at
        from app_users
        where id = :user_id
        limit 1
    """)

    with engine.connect() as conn:
        row = conn.execute(sql, {"user_id": user_uuid}).mappings().first()

    return _row_to_user_dict(row) if row else None


def create_user(
    *,
    name: str,
    email: str,
    password_hash: str,
    role: str = "user",
    status: str = "active",
) -> Dict[str, Any]:
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    sql = text("""
        insert into app_users (
            id,
            name,
            email,
            password_hash,
            role,
            status,
            is_active,
            created_at,
            updated_at,
            last_login_at
        ) values (
            :id,
            :name,
            :email,
            :password_hash,
            :role,
            :status,
            :is_active,
            :created_at,
            :updated_at,
            :last_login_at
        )
    """)

    with engine.begin() as conn:
        conn.execute(
            sql,
            {
                "id": user_id,
                "name": name.strip(),
                "email": email.strip().lower(),
                "password_hash": password_hash,
                "role": role,
                "status": status,
                "is_active": status == "active",
                "created_at": now,
                "updated_at": now,
                "last_login_at": None,
            },
        )

    user = find_user_by_id(user_id)
    if not user:
        raise ValueError("Gagal membuat user")

    return user


def update_user(updated_user: Dict[str, Any]) -> Dict[str, Any]:
    user_id = updated_user.get("id")
    if not user_id:
        raise ValueError("User ID tidak ditemukan")

    existing_user = find_user_by_id(user_id)
    if not existing_user:
        raise ValueError("User tidak ditemukan")

    now = datetime.now(timezone.utc)

    name = updated_user.get("name", existing_user["name"])
    email = updated_user.get("email", existing_user["email"])
    password_hash = updated_user.get("password_hash", existing_user["password_hash"])
    role = updated_user.get("role", existing_user.get("role", "user"))
    status = updated_user.get("status", existing_user.get("status", "active"))
    is_active = updated_user.get("is_active", status == "active")

    last_login_at = updated_user.get("last_login_at")

    if isinstance(last_login_at, str) and last_login_at:
        last_login_at = datetime.fromisoformat(last_login_at)
    elif isinstance(last_login_at, datetime):
        pass
    elif not last_login_at:
        existing_last_login = existing_user.get("last_login_at")
        last_login_at = datetime.fromisoformat(existing_last_login) if existing_last_login else None

    sql = text("""
        update app_users
        set
            name = :name,
            email = :email,
            password_hash = :password_hash,
            role = :role,
            status = :status,
            is_active = :is_active,
            last_login_at = :last_login_at,
            updated_at = :updated_at
        where id = :id
    """)

    with engine.begin() as conn:
        conn.execute(
            sql,
            {
                "id": user_id,
                "name": name.strip() if isinstance(name, str) else name,
                "email": email.strip().lower() if isinstance(email, str) else email,
                "password_hash": password_hash,
                "role": role,
                "status": status,
                "is_active": is_active,
                "last_login_at": last_login_at,
                "updated_at": now,
            },
        )

    user = find_user_by_id(user_id)
    if not user:
        raise ValueError("Gagal memperbarui user")

    return user


def delete_user_by_id(user_id: str) -> bool:
    sql = text("""
        delete from app_users
        where id = :user_id
    """)

    with engine.begin() as conn:
        result = conn.execute(sql, {"user_id": user_id})

    return result.rowcount > 0


def list_reset_tokens() -> list[Dict[str, Any]]:
    sql = text("""
        select
            id,
            user_id,
            token_hash,
            created_at,
            expires_at,
            used_at
        from password_reset_tokens
        order by created_at desc
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql).mappings().all()

    return [_row_to_reset_token_dict(row) for row in rows]


def create_reset_token(user_id: str, token: str, expires_minutes: int = 30) -> Dict[str, Any]:
    token_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=expires_minutes)

    sql = text("""
        insert into password_reset_tokens (
            id,
            user_id,
            token_hash,
            created_at,
            expires_at,
            used_at
        ) values (
            :id,
            :user_id,
            :token,
            :created_at,
            :expires_at,
            :used_at
        )
    """)

    with engine.begin() as conn:
        conn.execute(
            sql,
            {
                "id": token_id,
                "user_id": user_id,
                "token": token,
                "created_at": now,
                "expires_at": expires_at,
                "used_at": None,
            },
        )

    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select
                    id,
                    user_id,
                    token_hash,
                    created_at,
                    expires_at,
                    used_at
                from password_reset_tokens
                where id = :id
                limit 1
            """),
            {"id": token_id},
        ).mappings().first()

    if not row:
        raise ValueError("Gagal membuat reset token")

    return _row_to_reset_token_dict(row)


def find_valid_reset_token(token: str) -> Optional[Dict[str, Any]]:
    now = datetime.now(timezone.utc)

    sql = text("""
        select
            id,
            user_id,
            token_hash,
            created_at,
            expires_at,
            used_at
        from password_reset_tokens
        where token_hash = :token
          and used_at is null
          and expires_at >= :now
        order by created_at desc
        limit 1
    """)

    with engine.connect() as conn:
        row = conn.execute(
            sql,
            {
                "token": token,
                "now": now,
            },
        ).mappings().first()

    return _row_to_reset_token_dict(row) if row else None


def mark_reset_token_used(token: str) -> None:
    now = datetime.now(timezone.utc)

    sql = text("""
        update password_reset_tokens
        set used_at = :used_at
        where token_hash = :token
          and used_at is null
    """)

    with engine.begin() as conn:
        conn.execute(
            sql,
            {
                "token": token,
                "used_at": now,
            },
        )


# =========================
# SEED DEFAULT USERS
# =========================

# Passwords: adminPADIS123 / userPADIS123
# Generated via: werkzeug.security.generate_password_hash(...)
_DEFAULT_USERS = [
    {
        "name": "Admin",
        "email": "admin@padis.local",
        "password_hash": "scrypt:32768:8:1$GRJsksfU07bExXGi$8381324f51474276878610678030791438d960a587280f94ace33425d598fb7bf54f6f150534f3a6f451e4406fa98104597552470559f63bafbae89a8f3eb752",
        "role": "admin",
        "status": "active",
        "is_active": True,
    },
    {
        "name": "User",
        "email": "user@padis.local",
        "password_hash": "scrypt:32768:8:1$XGaoaGhqBoTALo60$e8796b30b4820690cfcf68e16a380f82b4c8c39bb765e88efbc134adb37d2a8cd852fa7671db353e2c7e68a7fdbde4427a83eb846dd4dba51c51af50c45efe03",
        "role": "user",
        "status": "active",
        "is_active": True,
    },
]


def seed_default_users() -> None:
    """
    Enforce default admin + user accounts.
    - Inserts if email does not exist.
    - Updates password_hash, role, status if email already exists.
    - Idempotent: safe to run multiple times.
    """
    sql = text("""
        INSERT INTO app_users (
            id,
            name,
            email,
            password_hash,
            role,
            status,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            :id,
            :name,
            :email,
            :password_hash,
            :role,
            :status,
            :is_active,
            :now,
            :now
        )
        ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            role          = EXCLUDED.role,
            status        = EXCLUDED.status,
            is_active     = EXCLUDED.is_active,
            updated_at    = EXCLUDED.updated_at
    """)

    now = datetime.now(timezone.utc)

    try:
        with engine.begin() as conn:
            for user in _DEFAULT_USERS:
                conn.execute(sql, {
                    "id": str(uuid.uuid4()),
                    "name": user["name"],
                    "email": user["email"],
                    "password_hash": user["password_hash"],
                    "role": user["role"],
                    "status": user["status"],
                    "is_active": user["is_active"],
                    "now": now,
                })

        logger.info("Default users enforced during seed")

    except Exception as e:
        logger.warning("Could not seed default users: %s", e)
