from flask import Flask, jsonify
from flask_cors import CORS
from auth import auth_bp

@app.route("/tickets", methods=["POST"])
@jwt_required()
def create_ticket():
    user_id = get_jwt_identity()
    data = request.json

    conn = get_db_connection()
    conn.execute(
        "INSERT INTO tickets (title, description, user_id) VALUES (?, ?, ?)",
        (data["title"], data["description"], user_id)
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Ticket created"}), 201