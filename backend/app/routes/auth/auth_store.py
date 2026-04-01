import json
import os
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "..", ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data", "_auth")

USERS_FILE = os.path.join(DATA_DIR, "users.json")
RESET_TOKENS_FILE = os.path.join(DATA_DIR, "reset_tokens.json")

_LOCK = threading.Lock()


def _ensure_data_dir() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)


def _read_json(path: str, default: Any) -> Any:
    _ensure_data_dir()

    if not os.path.exists(path):
        return default

    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return default


def _write_json(path: str, data: Any) -> None:
    _ensure_data_dir()

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def list_users() -> list[Dict[str, Any]]:
    with _LOCK:
        return _read_json(USERS_FILE, [])


def save_users(users: list[Dict[str, Any]]) -> None:
    with _LOCK:
        _write_json(USERS_FILE, users)


def find_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    email_norm = email.strip().lower()
    users = list_users()

    for user in users:
        if user.get("email", "").strip().lower() == email_norm:
            return user

    return None


def find_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    users = list_users()

    for user in users:
        if user.get("id") == user_id:
            return user

    return None


def create_user(
    *,
    name: str,
    email: str,
    password_hash: str,
    role: str = "user",
    status: str = "active",
) -> Dict[str, Any]:
    users = list_users()
    now_iso = datetime.now(timezone.utc).isoformat()

    new_user = {
        "id": str(uuid.uuid4()),
        "name": name.strip(),
        "email": email.strip().lower(),
        "password_hash": password_hash,
        "role": role,
        "status": status,
        "created_at": now_iso,
        "updated_at": now_iso,
        "last_login_at": None,
    }

    users.append(new_user)
    save_users(users)
    return new_user


def update_user(updated_user: Dict[str, Any]) -> Dict[str, Any]:
    users = list_users()

    for i, user in enumerate(users):
        if user.get("id") == updated_user.get("id"):
            updated_user["updated_at"] = datetime.now(timezone.utc).isoformat()
            users[i] = updated_user
            save_users(users)
            return updated_user

    raise ValueError("User tidak ditemukan")


def list_reset_tokens() -> list[Dict[str, Any]]:
    with _LOCK:
        return _read_json(RESET_TOKENS_FILE, [])


def save_reset_tokens(tokens: list[Dict[str, Any]]) -> None:
    with _LOCK:
        _write_json(RESET_TOKENS_FILE, tokens)


def create_reset_token(user_id: str, token: str, expires_minutes: int = 30) -> Dict[str, Any]:
    tokens = list_reset_tokens()
    now = datetime.now(timezone.utc)

    record = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "token": token,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(minutes=expires_minutes)).isoformat(),
        "used_at": None,
    }

    tokens.append(record)
    save_reset_tokens(tokens)
    return record


def find_valid_reset_token(token: str) -> Optional[Dict[str, Any]]:
    tokens = list_reset_tokens()
    now = datetime.now(timezone.utc)

    for item in tokens:
        if item.get("token") != token:
            continue

        if item.get("used_at") is not None:
            continue

        expires_at_raw = item.get("expires_at")
        if not expires_at_raw:
            continue

        expires_at = datetime.fromisoformat(expires_at_raw)
        if expires_at < now:
            continue

        return item

    return None


def mark_reset_token_used(token: str) -> None:
    tokens = list_reset_tokens()

    for item in tokens:
        if item.get("token") == token and item.get("used_at") is None:
            item["used_at"] = datetime.now(timezone.utc).isoformat()
            break

    save_reset_tokens(tokens)

def delete_user_by_id(user_id: str) -> bool:
    users = list_users()
    new_users = [user for user in users if user.get("id") != user_id]

    if len(new_users) == len(users):
        return False

    save_users(new_users)
    return True