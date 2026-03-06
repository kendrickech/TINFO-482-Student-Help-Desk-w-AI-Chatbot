# need to import Blueprint also from flask
from flask import Flask, request, jsonify

# do not need CORS here either, only in app.py
from flask_cors import CORS

# remove JWT, not using in the project so this whole line below
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt, JWTManager
import psycopg2

# not used so not needed
import os

# create a blueprint here from Flask, look at top of tickets.py for example
# then call it in the app.py, examples there as well

# everything below not needed here
app = Flask(__name__)
CORS(app, supports_credentials=True)
app.config["JWT_SECRET_KEY"] = "super-secret-key"
app.config["JWT_TOKEN_LOCATION"] = ["headers"]

# remove this since we're not using JWT
jwt = JWTManager(app)

# we have a get_db_connection() function in db.py. import from there
def get_db_connection():
    return psycopg2.connect(
        host="localhost",
        database="your_database",
        user="your_user",
        password="your_password"
    )


@app.route("/tickets/search-tickets", methods=["GET"])
# not using JWT so remove @jwt_required
@jwt_required()
def search_tickets():
    query = request.args.get("query")

    if not query or not query.strip():
        return jsonify({"message": "Search query required"}), 400

    # again we are not using JWT. for role authentication, use the admin_required or technician_required
    # from the auth.py file
    current_user = get_jwt_identity()
    claims = get_jwt()

    if claims.get("role") != "admin":
        return jsonify({"message": "Access denied"}), 403

    try:
        # using RealDictCursor makes it easier to index the dictionary, look at tickets.py or users_routes.py functions for examples
        conn = get_db_connection()
        cursor = conn.cursor()

        # the names for the columns are incorrect, as well as the database name itself, look at supabase for correct names
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

# backend server is already started when running app.py so we do not need this here
if __name__ == "__main__":
    app.run(debug=True, port=5000)