from flask import Flask, jsonify
from flask_cors import CORS
from auth import auth_bp

@app.route("/my-tickets", methods=["GET"])
@jwt_required()
def get_my_tickets():
    user_id = get_jwt_identity()

    conn = get_db_connection()
    tickets = conn.execute(
        "SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,)
    ).fetchall()
    conn.close()

    return jsonify([dict(ticket) for ticket in tickets])