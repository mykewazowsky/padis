from flask import Blueprint, jsonify, request

from app.routes.auth.auth_utils import admin_required, get_current_user_from_request
from app.routes.auth.auth_store import (
    list_users,
    find_user_by_id,
    update_user,
)

admin_user_bp = Blueprint("admin_user_bp", __name__)


def _sanitize_user(user):
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role", "user"),
        "status": user.get("status", "active"),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
        "last_login_at": user.get("last_login_at"),
    }


def _get_active_admin_count() -> int:
    users = list_users()
    return sum(
        1
        for user in users
        if user.get("role") == "admin" and user.get("status", "active") == "active"
    )


@admin_user_bp.route("/api/admin/users", methods=["GET"])
@admin_required
def admin_list_users():
    users = list_users()
    sanitized_users = [_sanitize_user(user) for user in users]
    sanitized_users.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return jsonify(sanitized_users)


@admin_user_bp.route("/api/admin/users/<user_id>/role", methods=["PATCH"])
@admin_required
def admin_update_user_role(user_id: str):
    data = request.get_json(silent=True) or {}
    new_role = str(data.get("role", "")).strip().lower()

    if new_role not in {"user", "admin"}:
        return jsonify({"error": "Role tidak valid"}), 400

    target_user = find_user_by_id(user_id)
    if not target_user:
        return jsonify({"error": "User tidak ditemukan"}), 404

    current_user = get_current_user_from_request()
    if not current_user:
        return jsonify({"error": "Unauthorized"}), 401

    is_self = current_user.get("id") == target_user.get("id")
    current_role = target_user.get("role", "user")

    if current_role == new_role:
        return jsonify({
            "message": "Role user tidak berubah",
            "user": _sanitize_user(target_user),
        })

    if is_self and new_role != "admin":
        return jsonify({
            "error": "Anda tidak dapat menurunkan role akun admin yang sedang digunakan."
        }), 400

    if current_role == "admin" and new_role != "admin":
        active_admin_count = _get_active_admin_count()
        if active_admin_count <= 1:
            return jsonify({
                "error": "Minimal harus ada satu admin aktif di sistem."
            }), 400

    target_user["role"] = new_role
    updated = update_user(target_user)

    return jsonify({
        "message": "Role user berhasil diperbarui",
        "user": _sanitize_user(updated),
    })


@admin_user_bp.route("/api/admin/users/<user_id>/status", methods=["PATCH"])
@admin_required
def admin_update_user_status(user_id: str):
    data = request.get_json(silent=True) or {}
    new_status = str(data.get("status", "")).strip().lower()

    if new_status not in {"active", "inactive"}:
        return jsonify({"error": "Status tidak valid"}), 400

    target_user = find_user_by_id(user_id)
    if not target_user:
        return jsonify({"error": "User tidak ditemukan"}), 404

    current_user = get_current_user_from_request()
    if not current_user:
        return jsonify({"error": "Unauthorized"}), 401

    is_self = current_user.get("id") == target_user.get("id")
    current_status = target_user.get("status", "active")
    current_role = target_user.get("role", "user")

    if current_status == new_status:
        return jsonify({
            "message": "Status user tidak berubah",
            "user": _sanitize_user(target_user),
        })

    if is_self and new_status != "active":
        return jsonify({
            "error": "Anda tidak dapat menonaktifkan akun yang sedang digunakan."
        }), 400

    if current_role == "admin" and current_status == "active" and new_status != "active":
        active_admin_count = _get_active_admin_count()
        if active_admin_count <= 1:
            return jsonify({
                "error": "Minimal harus ada satu admin aktif di sistem."
            }), 400

    target_user["status"] = new_status
    target_user["is_active"] = (new_status == "active")

    updated = update_user(target_user)

    return jsonify({
        "message": "Status user berhasil diperbarui",
        "user": _sanitize_user(updated),
    })