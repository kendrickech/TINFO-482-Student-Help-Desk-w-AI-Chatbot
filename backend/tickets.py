# tickets.py
from flask import Blueprint, request, jsonify, session
import psycopg2
from db import get_db_connection
from auth import login_required, admin_required

tickets_bp = Blueprint("tickets", __name__)

VALID_PRIORITY = {"low", "medium", "high"}
VALID_STATUS = {"open", "in_progress", "closed"}  # only used for admin updates


def _ticket_row_to_frontend(row):
    """
    row: (ticket_id, title, description, priority, created_at, created_by_username)
    Returns the object shape Tickets.jsx expects.
    """
    ticket_id, title, description, priority, created_at, created_by_username = row
    return {
        "id": ticket_id,
        "title": title,
        "description": description,
        "priority": priority,
        "createdBy": created_by_username,
        "createdAt": created_at.isoformat() if created_at else None,
    }


@tickets_bp.route("/tickets", methods=["GET"])
@login_required
def list_tickets():
    user_id = session.get("user_id")
    role = session.get("user_role")

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if role == "admin":
            cur.execute(
                """
                SELECT t.ticket_id, t.title, t.description, t.priority, t.created_at, u.username
                FROM ticket_table t
                JOIN user_table u ON u.user_id = t.created_by
                ORDER BY t.ticket_id ASC
                """
            )
        else:
            # Students see only their own tickets
            cur.execute(
                """
                SELECT t.ticket_id, t.title, t.description, t.priority, t.created_at, u.username
                FROM ticket_table t
                JOIN user_table u ON u.user_id = t.created_by
                WHERE t.created_by = %s
                ORDER BY t.ticket_id ASC
                """,
                (user_id,),
            )

        rows = cur.fetchall()
        tickets = [_ticket_row_to_frontend(r) for r in rows]
        return jsonify({"tickets": tickets}), 200

    finally:
        cur.close()
        conn.close()


@tickets_bp.route("/tickets", methods=["POST"])
@login_required
def create_ticket():
    created_by_id = session.get("user_id")
    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    priority = (data.get("priority") or "low").strip().lower()

    if not title or not description:
        return jsonify({"error": "Title and description are required"}), 400

    # Keep validation even with dropdown (prevents junk manual requests)
    if priority not in VALID_PRIORITY:
        return jsonify({"error": "priority must be low, medium, or high"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # status defaults to 'open' in DB (recommended)
        # assigned_to defaults to NULL by omission
        cur.execute(
            """
            INSERT INTO ticket_table (title, description, priority, created_by)
            VALUES (%s, %s, %s, %s)
            RETURNING ticket_id, created_at
            """,
            (title, description, priority, created_by_id),
        )
        inserted = cur.fetchone()

        # get username for response
        cur.execute("SELECT username FROM user_table WHERE user_id = %s", (created_by_id,))
        u = cur.fetchone()
        username = u[0] if u else "unknown"

        conn.commit()

        ticket_id, created_at = inserted
        return jsonify({
            "ticket": {
                "id": ticket_id,
                "title": title,
                "description": description,
                "priority": priority,
                "createdBy": username,
                "createdAt": created_at.isoformat() if created_at else None,
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


@tickets_bp.route("/tickets/<int:ticket_id>/status", methods=["PATCH"])
@login_required
@admin_required
def update_ticket_status(ticket_id):
    """
    Admin-only: update status (open, in_progress, closed)
    """
    data = request.get_json(silent=True) or {}
    status = (data.get("status") or "").strip().lower()

    if status not in VALID_STATUS:
        return jsonify({"error": "status must be open, in_progress, or closed"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE ticket_table
            SET status = %s, updated_at = CURRENT_TIMESTAMP
            WHERE ticket_id = %s
            """,
            (status, ticket_id),
        )
        updated = cur.rowcount
        conn.commit()

        if updated == 0:
            return jsonify({"error": "Ticket not found"}), 404

        return jsonify({"message": "Status updated"}), 200
    finally:
        cur.close()
        conn.close()


@tickets_bp.route("/tickets/<int:ticket_id>/assign", methods=["PATCH"])
@login_required
@admin_required
def assign_ticket(ticket_id):
    """
    Admin-only: assign ticket to a user_id (or unassign with null)
    """
    data = request.get_json(silent=True) or {}
    assigned_to = data.get("assigned_to")

    # allow unassign
    if assigned_to in ("", None):
        assigned_to = None
    else:
        try:
            assigned_to = int(assigned_to)
        except (TypeError, ValueError):
            return jsonify({"error": "assigned_to must be an integer user_id or null"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE ticket_table
            SET assigned_to = %s, updated_at = CURRENT_TIMESTAMP
            WHERE ticket_id = %s
            """,
            (assigned_to, ticket_id),
        )
        updated = cur.rowcount
        conn.commit()

        if updated == 0:
            return jsonify({"error": "Ticket not found"}), 404

        return jsonify({"message": "Assignment updated"}), 200
    finally:
        cur.close()
        conn.close()
