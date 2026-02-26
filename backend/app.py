# app.py
import os
from flask import Flask, jsonify
from flask_cors import CORS
from auth import auth_bp
from dotenv import load_dotenv
from pathlib import Path
from users_routes import users_bp
from tickets import tickets_bp

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY")  # fine for school
CORS(app, supports_credentials=True, origins=["http://localhost:5173"])

app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
app.register_blueprint(tickets_bp)

@app.get("/health")
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

@app.route("/admin/search-tickets", methods=["GET"])
@jwt_required()
def search_tickets():
    search_value = request.args.get("query")

    conn = get_db_connection()

    tickets = conn.execute("""
        SELECT tickets.*, users.email, users.student_number
        FROM tickets
        JOIN users ON tickets.user_id = users.id
        WHERE users.email = ?
        OR users.student_number = ?
        ORDER BY tickets.created_at DESC
    """, (search_value, search_value)).fetchall()

    conn.close()

    return jsonify([dict(ticket) for ticket in tickets])