from flask import Blueprint, request, jsonify, session
from psycopg2.extras import RealDictCursor
from datetime import datetime
import psycopg2

from db import get_db_connection
from auth import login_required, admin_required

tickets_bp = Blueprint("tickets", __name__)

VALID_PRIORITY = {"low", "medium", "high"}

def iso(dt):
    return dt.isoformat() if isinstance(dt, datetime) else None


@tickets_bp.route("/tickets", methods=["GET"])
@login_required
def list_tickets():
    user_id = session.get("user_id")
    role = session.get("user_role")

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if role == "admin":
            cur.execute(
                """
                SELECT
                  t.ticket_id AS id,
                  t.title,
                  t.description,
                  t.priority,
                  t.status,
                  t.created_at AS "createdAt",
                  u.username AS "createdBy"
                FROM ticket_table t
                JOIN user_table u ON u.user_id = t.created_by
                ORDER BY t.ticket_id ASC
                """
            )
        else:
            cur.execute(
                """
                SELECT
                  t.ticket_id AS id,
                  t.title,
                  t.description,
                  t.priority,
                  t.status,
                  t.created_at AS "createdAt",
                  u.username AS "createdBy"
                FROM ticket_table t
                JOIN user_table u ON u.user_id = t.created_by
                WHERE t.created_by = %s
                ORDER BY t.ticket_id ASC
                """,
                (user_id,),
            )

        rows = cur.fetchall()

        tickets = []
        for r in rows:
            tickets.append({
                "id": r["id"],
                "title": r["title"],
                "description": r["description"],
                "priority": r["priority"],
                "status": r["status"],  # optional for UI later
                "createdBy": r["createdBy"],
                "createdAt": iso(r.get("createdAt")),
            })

        return jsonify({"tickets": tickets}), 200

    except psycopg2.Error as e:
        return jsonify({"error": "Database error", "details": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@tickets_bp.route("/tickets", methods=["POST"])
@login_required
def create_ticket():
    created_by = session.get("user_id")
    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    priority = (data.get("priority") or "low").strip().lower()

    if not title or not description:
        return jsonify({"error": "Title and description are required"}), 400

    if priority not in VALID_PRIORITY:
        return jsonify({"error": "priority must be low, medium, or high"}), 400

    # If your DB defaults are set, you can omit status and assigned_to.
    # If not, keep status='open' here.
    status = "open"

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            INSERT INTO ticket_table (title, description, status, priority, created_by, assigned_to)
            VALUES (%s, %s, %s, %s, %s, NULL)
            RETURNING ticket_id AS id, created_at AS "createdAt"
            """,
            (title, description, status, priority, created_by),
        )
        inserted = cur.fetchone()

        cur.execute("SELECT username FROM user_table WHERE user_id = %s", (created_by,))
        u = cur.fetchone()
        username = u["username"] if u else "unknown"

        conn.commit()

        return jsonify({
            "ticket": {
                "id": inserted["id"],
                "title": title,
                "description": description,
                "priority": priority,
                "createdBy": username,
                "createdAt": iso(inserted.get("createdAt")),
            }
        }), 201

    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({"error": "Database error", "details": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@tickets_bp.route("/tickets/<int:ticket_id>", methods=["GET"])
@login_required
def get_ticket(ticket_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute(
            """
            SELECT
              t.ticket_id AS id,
              t.title,
              t.description,
              t.priority,
              t.status,
              t.created_at AS "createdAt",
              u.username AS "createdBy"
            FROM ticket_table t
            JOIN user_table u ON u.user_id = t.created_by
            WHERE t.ticket_id = %s
            """,
            (ticket_id,),
        )

        r = cur.fetchone()

        if not r:
            return jsonify({"error": "Ticket not found"}), 404

        ticket = {
            "id": r["id"],
            "title": r["title"],
            "description": r["description"],
            "priority": r["priority"],
            "status": r["status"],
            "createdBy": r["createdBy"],
            "createdAt": iso(r.get("createdAt")),
        }

        return jsonify({"ticket": ticket}), 200

    except psycopg2.Error as e:
        return jsonify({"error": "Database error", "details": str(e)}), 500

    finally:
        cur.close()
        conn.close()

@tickets_bp.route("/tickets/<int:ticket_id>/comments", methods=["GET"])
@login_required
def list_comments(ticket_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT
              c.comment_id,
              c.message,
              c.created_at,
              u.username
            FROM ticket_comment_table c
            JOIN user_table u ON u.user_id = c.created_by
            WHERE c.ticket_id = %s
            ORDER BY c.created_at ASC
            """,
            (ticket_id,),
        )
        return jsonify({"comments": cur.fetchall()}), 200
    finally:
        cur.close()
        conn.close()

@tickets_bp.route("/tickets/<int:ticket_id>/comments", methods=["POST"])
@login_required
def add_comment(ticket_id):
    user_id = session.get("user_id")
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()

    if not message:
        return jsonify({"error": "Message is required"}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # ensure ticket exists
        cur.execute("SELECT ticket_id FROM ticket_table WHERE ticket_id = %s", (ticket_id,))
        if not cur.fetchone():
            return jsonify({"error": "Ticket not found"}), 404

        cur.execute(
            """
            INSERT INTO ticket_comment_table (message, ticket_id, created_by)
            VALUES (%s, %s, %s)
            RETURNING comment_id, message, created_at
            """,
            (message, ticket_id, user_id),
        )
        new_comment = cur.fetchone()

        cur.execute("SELECT username FROM user_table WHERE user_id = %s", (user_id,))
        u = cur.fetchone()

        conn.commit()

        return jsonify({
            "comment": {
                "comment_id": new_comment["comment_id"],
                "message": new_comment["message"],
                "created_at": new_comment["created_at"],
                "username": u["username"] if u else "unknown",
            }
        }), 201

    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({"error": "Database error", "details": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@tickets_bp.route("/tickets/<int:ticket_id>", methods=["DELETE"])
@login_required
@admin_required
def delete_ticket(ticket_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM ticket_table WHERE ticket_id = %s", (ticket_id,))
        deleted = cur.rowcount
        conn.commit()

        if deleted == 0:
            return jsonify({"error": "Ticket not found"}), 404

        return jsonify({"message": "Ticket deleted"}), 200
    finally:
        cur.close()
        conn.close()
