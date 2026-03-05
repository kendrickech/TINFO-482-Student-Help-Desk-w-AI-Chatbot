# users_routes.py
from flask import Blueprint, request, session, jsonify
from db import get_db_connection

users_bp = Blueprint("users_bp", __name__)

def get_current_user():
    uid = session.get("user_id")
    if not uid:
        return None

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id, username, user_role
                FROM user_table
                WHERE user_id = %s
                """,
                (uid,),
            )
            return cur.fetchone()
    finally:
        conn.close()


def require_admin():
    user = get_current_user()

    if not user:
        return None, (jsonify({"error": "Not logged in"}), 401)

    if user["user_role"] != "admin":
        return None, (jsonify({"error": "Forbidden"}), 403)

    return user, None


# GET /users
@users_bp.get("/users")
def list_users():
    _, err = require_admin()
    if err:
        return err

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id AS id,
                       username,
                       email,
                       user_role AS role
                FROM user_table
                ORDER BY user_id ASC
                """
            )
            users = cur.fetchall()
            return jsonify(users), 200
    finally:
        conn.close()


# PATCH /users/<id>/role
@users_bp.patch("/users/<int:user_id>/role")
def update_user_role(user_id):
    current_user, err = require_admin()
    if err:
        return err

    if current_user["user_id"] == user_id:
        return jsonify({"error": "You cannot change your own role."}), 400

    data = request.get_json()
    new_role = data.get("role")

    if new_role not in ("student", "technician", "admin"):
        return jsonify({"error": "Invalid role"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE user_table
                SET user_role = %s
                WHERE user_id = %s
                RETURNING user_id AS id,
                          username,
                          email,
                          user_role AS role
                """,
                (new_role, user_id),
            )
            updated = cur.fetchone()

            if not updated:
                return jsonify({"error": "User not found"}), 404

            conn.commit()
            return jsonify(updated), 200
    finally:
        conn.close()


# DELETE /users/<id>
@users_bp.delete("/users/<int:user_id>")
def delete_user(user_id):
    current_user, err = require_admin()
    if err:
        return err

    if current_user["user_id"] == user_id:
        return jsonify({"error": "You cannot delete your own account."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM user_table WHERE user_id = %s RETURNING user_id",
                (user_id,),
            )
            deleted = cur.fetchone()

            if not deleted:
                return jsonify({"error": "User not found"}), 404

            conn.commit()
            return jsonify({"success": True}), 200
    finally:
        conn.close()
