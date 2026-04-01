import os
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request, g

from .auth_store import (
    create_reset_token,
    create_user,
    find_user_by_email,
    find_user_by_id,
    find_valid_reset_token,
    mark_reset_token_used,
    update_user,
)
from .auth_utils import (
    generate_access_token,
    generate_reset_token,
    hash_password,
    login_required,
    verify_password,
)

auth_bp = Blueprint("auth_bp", __name__)


def _get_json():
    return request.get_json(silent=True) or {}


def _serialize_user(user):
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "status": user["status"],
        "created_at": user.get("created_at"),
        "last_login_at": user.get("last_login_at"),
    }


@auth_bp.route("/api/register", methods=["POST"])
def register():
    data = _get_json()

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not name:
        return jsonify({"error": "Nama wajib diisi"}), 400

    if not email:
        return jsonify({"error": "Email wajib diisi"}), 400

    if "@" not in email or "." not in email:
        return jsonify({"error": "Format email tidak valid"}), 400

    if not password:
        return jsonify({"error": "Password wajib diisi"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password minimal 8 karakter"}), 400

    existing_user = find_user_by_email(email)
    if existing_user:
        return jsonify({"error": "Email sudah terdaftar"}), 409

    user = create_user(
        name=name,
        email=email,
        password_hash=hash_password(password),
        role="user",
        status="active",
    )

    return jsonify(
        {
            "message": "Registrasi berhasil",
            "user": _serialize_user(user),
        }
    ), 201


@auth_bp.route("/api/login", methods=["POST"])
def login():
    data = _get_json()

    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not email:
        return jsonify({"error": "Email wajib diisi"}), 400

    if not password:
        return jsonify({"error": "Password wajib diisi"}), 400

    user = find_user_by_email(email)
    if not user:
        return jsonify({"error": "Email atau password salah"}), 401

    if user.get("status") != "active":
        return jsonify({"error": "Akun tidak aktif"}), 403

    if not verify_password(password, user.get("password_hash", "")):
        return jsonify({"error": "Email atau password salah"}), 401

    user["last_login_at"] = datetime.now(timezone.utc).isoformat()
    update_user(user)

    token = generate_access_token(user)

    return jsonify(
        {
            "message": "Login berhasil",
            "token": token,
            "user": _serialize_user(user),
        }
    ), 200


@auth_bp.route("/api/me", methods=["GET"])
@login_required
def me():
    user = g.current_user

    return jsonify(
        {
            "user": _serialize_user(user)
        }
    ), 200


@auth_bp.route("/api/logout", methods=["POST"])
@login_required
def logout():
    return jsonify({"message": "Logout berhasil"}), 200


@auth_bp.route("/api/forgot-password", methods=["POST"])
def forgot_password():
    data = _get_json()
    email = str(data.get("email", "")).strip().lower()

    if not email:
        return jsonify({"error": "Email wajib diisi"}), 400

    user = find_user_by_email(email)

    if user:
        token = generate_reset_token(user)
        create_reset_token(user["id"], token, expires_minutes=30)

        frontend_base_url = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
        reset_link = f"{frontend_base_url}/reset-password?token={token}"

        return jsonify(
            {
                "message": "Jika email terdaftar, tautan reset password telah dibuat.",
                "reset_token": token,
                "reset_link": reset_link,
            }
        ), 200

    return jsonify(
        {
            "message": "Jika email terdaftar, tautan reset password telah dibuat."
        }
    ), 200


@auth_bp.route("/api/reset-password", methods=["POST"])
def reset_password():
    data = _get_json()

    token = str(data.get("token", "")).strip()
    password = str(data.get("password", ""))

    if not token:
        return jsonify({"error": "Token reset password wajib diisi"}), 400

    if not password:
        return jsonify({"error": "Password baru wajib diisi"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password minimal 8 karakter"}), 400

    token_record = find_valid_reset_token(token)
    if not token_record:
        return jsonify(
            {"error": "Token reset password tidak valid atau sudah kedaluwarsa"}
        ), 400

    user_id = token_record.get("user_id")
    user = find_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User tidak ditemukan"}), 404

    user["password_hash"] = hash_password(password)
    update_user(user)

    mark_reset_token_used(token)

    return jsonify({"message": "Password berhasil diperbarui"}), 200