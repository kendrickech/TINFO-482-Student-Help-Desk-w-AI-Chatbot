#auth.py
from functools import wraps

from flask import Blueprint, request, jsonify, session
from werkzeug.security import check_password_hash, generate_password_hash
from db import get_db_connection
import psycopg2

auth_bp = Blueprint("auth", __name__)

# --------- helpers / guards ---------
def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Not authenticated"}), 401
        return fn(*args, **kwargs)
    return wrapper

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if session.get("user_role") != "admin":
            return jsonify({"error": "Admin only"}), 403
        return fn(*args, **kwargs)
    return wrapper

def col(row, name, index):
    """Read column from either RealDictCursor (dict) or default cursor (tuple)."""
    if row is None:
        return None
    return row[name] if isinstance(row, dict) else row[index]

# --------- auth routes ---------
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or not email or not password:
        return jsonify({"error": "Username, email, and password are required"}), 400

    '''if user_role not in ("student", "technician"):
        return jsonify({"error": "Invalid user_role. Use 'student' or 'technician'."}), 400'''
    
    user_role = "student"

    password_hash = generate_password_hash(password)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Check duplicates for email and username
        cur.execute("SELECT 1 FROM user_table WHERE email = %s", (email,))
        if cur.fetchone():
            return jsonify({"error": "Email already registered"}), 409

        cur.execute("SELECT 1 FROM user_table WHERE username = %s", (username,))
        if cur.fetchone():
            return jsonify({"error": "Username already taken"}), 409

        # Insert user
        cur.execute(
            """
            INSERT INTO user_table (username, email, password_hash, user_role)
            VALUES (%s, %s, %s, %s)
            RETURNING user_id, user_role
            """,
            (username, email, password_hash, user_role),
        )
        row = cur.fetchone()
        user_id = col(row, "user_id", 0)
        role = col(row, "user_role", 1)
        conn.commit()

        # Optional: log them in immediately
        session["user_id"] = user_id
        session["user_role"] = role

        return jsonify({"message": "Registration successful", "role": role}), 201

    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({"error": "Database error", "details": str(e)}), 500
    finally:
        cur.close()
        conn.close()



@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    username = data.get("username") or ""
    password = data.get("password") or ""

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT user_id, password_hash, user_role FROM user_table WHERE username = %s",
        (username,),
    )
    user = cur.fetchone()
    cur.close()
    conn.close()

    #if user and check_password_hash(user["password_hash"], password):
    if not user:
        return jsonify({"error": "Invalid username or password"}), 401
    
    user_id = col(user, "user_id", 0)
    stored = col(user, "password_hash", 1)
    role = col(user, "user_role", 2)

    # Backward compatible:
    # - if stored looks like a werkzeug hash, verify hash
    # - else treat stored as plaintext (so you don't break existing rows)
    is_hash = isinstance(stored, str) and (stored.startswith("pbkdf2:") or stored.startswith("scrypt:"))
    ok = check_password_hash(stored, password) if is_hash else (stored == password)

    if ok:
        session["user_id"] = user_id
        session["user_role"] = role
        return jsonify({"message": "Login successful", "role": role}), 200

    return jsonify({"error": "Invalid username or password"}), 401



@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200



@auth_bp.route("/me", methods=["GET"])
def me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"authenticated": False}), 200

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT user_id, username, user_role FROM user_table WHERE user_id = %s",
            (user_id,)
        )
        row = cur.fetchone()

        if not row:
            # Session exists but user no longer exists in DB
            session.clear()
            return jsonify({"authenticated": False}), 200

        uid = col(row, "user_id", 0)
        username = col(row, "username", 1)
        role = col(row, "user_role", 2)

        # Keep session in sync (optional but helpful)
        session["user_role"] = role

        return jsonify({
            "authenticated": True,
            "user_id": uid,
            "username": username,
            "user_role": role,
        }), 200
    finally:
        cur.close()
        conn.close()



# --------- admin routes ---------
@auth_bp.route("/admin/users", methods=["GET"])
@login_required
@admin_required
def admin_list_users():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT user_id, username, email, user_role, created_at FROM user_table ORDER BY user_id DESC"
        )
        rows = cur.fetchall()
        return jsonify({
            "users": [
                {
                    "user_id": r[0],
                    "username": r[1],
                    "email": r[2],
                    "user_role": r[3],
                    "created_at": r[4].isoformat() if r[4] else None,
                }
                for r in rows
            ]
        }), 200
    finally:
        cur.close()
        conn.close()



@auth_bp.route("/admin/users/<int:user_id>/role", methods=["PATCH"])
@login_required
@admin_required
def admin_set_role(user_id):
    data = request.get_json() or {}
    new_role = (data.get("user_role") or "").strip().lower()

    # You can restrict this however you want. Here: admin can set student/technician only.
    if new_role not in ("student", "technician"):
        return jsonify({"error": "user_role must be 'student' or 'technician'"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE user_table
            SET user_role = %s
            WHERE user_id = %s
            RETURNING user_id, username, user_role
            """,
            (new_role, user_id),
        )
        updated = cur.fetchone()
        conn.commit()

        if not updated:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "message": "Role updated",
            "user": {"user_id": updated[0], "username": updated[1], "user_role": updated[2]},
        }), 200
    finally:
        cur.close()
        conn.close()
