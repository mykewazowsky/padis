from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any, Callable, Dict

import jwt
from flask import current_app, jsonify, request, g
from werkzeug.security import check_password_hash, generate_password_hash

from .auth_store import find_user_by_id


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return check_password_hash(password_hash, password)


def generate_reset_token(user: Dict[str, Any]) -> str:
    secret = current_app.config["JWT_SECRET_KEY"]
    now = datetime.now(timezone.utc)

    payload = {
        "type": "reset_password",
        "sub": user["id"],
        "email": user["email"],
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=30)).timestamp()),
    }

    return jwt.encode(payload, secret, algorithm="HS256")


def generate_access_token(user: Dict[str, Any], expires_hours: int = 12) -> str:
    secret = current_app.config["JWT_SECRET_KEY"]
    now = datetime.now(timezone.utc)

    payload = {
        "type": "access",
        "sub": user["id"],
        "email": user["email"],
        "role": user.get("role", "user"),
        "status": user.get("status", "active"),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=expires_hours)).timestamp()),
    }

    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(token: str) -> Dict[str, Any]:
    secret = current_app.config["JWT_SECRET_KEY"]
    payload = jwt.decode(token, secret, algorithms=["HS256"])
    return payload


def get_bearer_token() -> str | None:
    auth_header = request.headers.get("Authorization", "").strip()
    parts = auth_header.split()

    if len(parts) != 2 or parts[0] != "Bearer":
        return None

    return parts[1]


def get_current_user_from_request() -> Dict[str, Any] | None:
    token = get_bearer_token()
    if not token:
        return None

    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        return None

    if payload.get("type") not in (None, "access"):
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    user = find_user_by_id(user_id)
    if not user:
        return None

    if user.get("status") != "active":
        return None

    return user


def login_required(fn: Callable) -> Callable:
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user_from_request()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401

        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def admin_required(fn: Callable) -> Callable:
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user_from_request()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401

        if user.get("role") != "admin":
            return jsonify({"error": "Forbidden"}), 403

        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper