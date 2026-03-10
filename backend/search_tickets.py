# create a blueprint here from Flask, look at top of tickets.py for example
import os
from flask import Blueprint, request, jsonify, session
from psycopg2.extras import RealDictCursor
from datetime import datetime
import psycopg2

from db import get_db_connection
from auth import login_required, admin_required

search_tickets_bp = Blueprint("search_tickets", __name__)

VALID_PRIORITY = {"low", "medium", "high"}

def iso(dt):
    return dt.isoformat() if isinstance(dt, datetime) else None

def get_db_connection():
    

    try:
        connection = psycopg2.connect(
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            dbname=os.getenv("DB_NAME"),
            sslmode="require",  # required for Supabase/Neon
            cursor_factory=RealDictCursor
        )
        return connection
    except Exception as e:
        print(f"Database connection failed: {e}")
        raise


@search_tickets_bp.route("/tickets/<int:ticket_id>", methods=["GET"])
@login_required
@admin_required
def search_tickets():

    search_value = request.args.get("query")

    if not search_value:
        return jsonify({"message": "Search query required"}), 400

    conn = get_db_connection()
    curr = conn.cursor(cursor_factory=RealDictCursor)

    curr.execute("""
        SELECT tickets.id,
               tickets.title,
               tickets.description,
               tickets.status,
               users.email,
               users.student_number
        FROM tickets
        JOIN users ON tickets.user_id = users.id
        WHERE users.email ILIKE %s
           OR CAST(users.student_number AS TEXT) ILIKE %s
        ORDER BY tickets.created_at DESC
    """, (f"%{search_value}%", f"%{search_value}%"))

    tickets = curr.fetchall()

    curr.close()
    conn.close()

    return jsonify({"tickets": tickets}), 200