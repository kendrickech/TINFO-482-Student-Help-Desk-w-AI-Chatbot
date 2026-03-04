from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt, JWTManager
import psycopg2
import os

app = Flask(__name__)
CORS(app, supports_credentials=True)

app.config["JWT_SECRET_KEY"] = "super-secret-key"
app.config["JWT_TOKEN_LOCATION"] = ["headers"]

jwt = JWTManager(app)

def get_db_connection():
    return psycopg2.connect(
        host="localhost",
        database="your_database",
        user="your_user",
        password="your_password"
    )

@app.route("/tickets/search-tickets", methods=["GET"])
@jwt_required()
def search_tickets():
    query = request.args.get("query")

    if not query or not query.strip():
        return jsonify({"message": "Search query required"}), 400

    current_user = get_jwt_identity()
    claims = get_jwt()

    if claims.get("role") != "admin":
        return jsonify({"message": "Access denied"}), 403

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, title, description, status, email, student_number
            FROM tickets
            WHERE email ILIKE %s
               OR CAST(student_number AS TEXT) ILIKE %s
            ORDER BY id DESC
            """,
            (f"%{query}%", f"%{query}%")
        )

        tickets = cursor.fetchall()

        cursor.close()
        conn.close()

        results = []
        for t in tickets:
            results.append({
                "id": t[0],
                "title": t[1],
                "description": t[2],
                "status": t[3],
                "email": t[4],
                "student_number": t[5],
            })

        return jsonify(results), 200

    except Exception as e:
        print("Search error:", e)
        return jsonify({"message": "Server error"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)