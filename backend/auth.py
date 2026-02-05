#auth.py
from flask import Blueprint, request, jsonify, session
from werkzeug.security import check_password_hash
from db import get_db_connection

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    username = data["username"]
    password = data["password"]

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT user_id, password_hash, user_role FROM user_table WHERE username = %s",
        (username,)
    )

    user = cur.fetchone()
    cur.close()
    conn.close()

    #if user and check_password_hash(user["password_hash"], password):
    if user and user[1] == password:
        session["user_id"] = user[0]
        session["user_role"] = user[2]

        return jsonify({
            "message": "Login successful",
            "role": user[2]
        }), 200

    return jsonify({"error": "Invalid username or password"}), 401
