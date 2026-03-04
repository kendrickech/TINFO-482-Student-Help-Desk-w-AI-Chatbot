from flask import Blueprint, request, jsonify, session
from psycopg2.extras import RealDictCursor
from datetime import datetime
import psycopg2

from db import get_db_connection
from auth import login_required, admin_required, technician_required

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
        if role in ("admin", "technician"):
            cur.execute(
                """
                SELECT
                    t.ticket_id AS id,
                    t.title,
                    t.description,
                    t.priority,
                    t.status,
                    t.created_at AS "createdAt",
                    t.archived_at AS "archivedAt",
                    creator.username AS "createdBy",
                    t.assigned_to AS "assignedTo",
                    assignee.username AS "assignedUsername",
                    assignee.user_role AS "assignedRole"
                FROM ticket_table t
                JOIN user_table creator ON creator.user_id = t.created_by
                LEFT JOIN user_table assignee ON assignee.user_id = t.assigned_to
                WHERE t.archived_at IS NULL
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
                    t.archived_at AS "archivedAt",
                    creator.username AS "createdBy",
                    t.assigned_to AS "assignedTo",
                    assignee.username AS "assignedUsername",
                    assignee.user_role AS "assignedRole"
                FROM ticket_table t
                JOIN user_table creator ON creator.user_id = t.created_by
                LEFT JOIN user_table assignee ON assignee.user_id = t.assigned_to
                WHERE t.created_by = %s
                    AND t.archived_at IS NULL
                ORDER BY t.ticket_id ASC
                """,
                (user_id,),
            )

        rows = cur.fetchall()

        tickets = []
        for r in rows:
            tickets.append(
                {
                    "id": r["id"],
                    "title": r["title"],
                    "description": r["description"],
                    "priority": r["priority"],
                    "status": r["status"],
                    "createdBy": r["createdBy"],
                    "createdAt": iso(r.get("createdAt")),
                    "assignedTo": r.get("assignedTo"),
                    "assignedUsername": r.get("assignedUsername"),
                    "assignedRole": r.get("assignedRole"),
                    "archivedAt": iso(r.get("archivedAt")),
                }
            )

        return jsonify({"tickets": tickets}), 200

    except psycopg2.Error as e:
        return jsonify({"error": "Database error", "details": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@tickets_bp.route("/tickets/archived", methods=["GET"])
@login_required
@technician_required
def list_archived_tickets():

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
              t.archived_at AS "archivedAt",
              creator.username AS "createdBy",
              t.assigned_to AS "assignedTo",
              assignee.username AS "assignedUsername",
              assignee.user_role AS "assignedRole"
            FROM ticket_table t
            JOIN user_table creator ON creator.user_id = t.created_by
            LEFT JOIN user_table assignee ON assignee.user_id = t.assigned_to
            WHERE t.archived_at IS NOT NULL
            ORDER BY t.archived_at DESC
            """
        )

        rows = cur.fetchall()
        tickets = []
        for r in rows:
            tickets.append(
                {
                    "id": r["id"],
                    "title": r["title"],
                    "description": r["description"],
                    "priority": r["priority"],
                    "status": r["status"],
                    "createdBy": r["createdBy"],
                    "createdAt": iso(r.get("createdAt")),
                    "archivedAt": iso(r.get("archivedAt")),
                    "assignedTo": r.get("assignedTo"),
                    "assignedUsername": r.get("assignedUsername"),
                    "assignedRole": r.get("assignedRole"),
                }
            )

        return jsonify({"tickets": tickets}), 200

    except psycopg2.Error as e:
        return jsonify({"error": "Database error", "details": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@tickets_bp.route("/tickets/<int:ticket_id>/archive", methods=["PATCH"])
@login_required
@technician_required
def archive_ticket(ticket_id):

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            UPDATE ticket_table
            SET archived_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE ticket_id = %s
              AND archived_at IS NULL
            RETURNING ticket_id AS id, archived_at AS "archivedAt"
            """,
            (ticket_id,),
        )
        r = cur.fetchone()
        conn.commit()

        if not r:
            return jsonify({"error": "Ticket not found or already archived"}), 404

        return jsonify({"message": "Ticket archived", "id": r["id"], "archivedAt": iso(r.get("archivedAt"))}), 200

    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({"error": "Database error", "details": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@tickets_bp.route("/tickets/<int:ticket_id>/unarchive", methods=["PATCH"])
@login_required
@technician_required
def unarchive_ticket(ticket_id):
   
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            UPDATE ticket_table
            SET archived_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE ticket_id = %s
              AND archived_at IS NOT NULL
            RETURNING ticket_id AS id
            """,
            (ticket_id,),
        )
        r = cur.fetchone()
        conn.commit()

        if not r:
            return jsonify({"error": "Ticket not found or not archived"}), 404

        return jsonify({"message": "Ticket unarchived", "id": r["id"]}), 200

    except psycopg2.Error as e:
        conn.rollback()
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

        return (
            jsonify(
                {
                    "ticket": {
                        "id": inserted["id"],
                        "title": title,
                        "description": description,
                        "priority": priority,
                        "createdBy": username,
                        "createdAt": iso(inserted.get("createdAt")),
                    }
                }
            ),
            201,
        )

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
              creator.username AS "createdBy",
              t.assigned_to AS "assignedTo",
              t.archived_at AS "archivedAt",
              assignee.username AS "assignedUsername",
              assignee.user_role AS "assignedRole"
            FROM ticket_table t
            JOIN user_table creator ON creator.user_id = t.created_by
            LEFT JOIN user_table assignee ON assignee.user_id = t.assigned_to
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
            "assignedTo": r.get("assignedTo"),
            "assignedUsername": r.get("assignedUsername"),
            "assignedRole": r.get("assignedRole"),
            "archivedAt": iso(r.get("archivedAt")),
        }

        return jsonify({"ticket": ticket}), 200

    except psycopg2.Error as e:
        return jsonify({"error": "Database error", "details": str(e)}), 500

    finally:
        cur.close()
        conn.close()


@tickets_bp.route("/assignees", methods=["GET"])
@login_required
@technician_required
def list_assignees():
    """
    Returns users who can be assigned tickets: technicians + admins.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT user_id AS id, username, user_role AS role
            FROM user_table
            WHERE user_role IN ('technician', 'admin')
            ORDER BY role, username
            """
        )
        return jsonify({"assignees": cur.fetchall()}), 200
    finally:
        cur.close()
        conn.close()


@tickets_bp.route("/tickets/<int:ticket_id>/assign", methods=["PATCH"])
@login_required
@admin_required
def assign_ticket(ticket_id):
    """
    Admin-only. Assign or unassign a ticket.
    Body: { "assignedTo": <int> } to assign, or { "assignedTo": null } to unassign.
    """
    data = request.get_json(silent=True) or {}
    assigned_to = data.get("assignedTo", None)  # int or None

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Ensure ticket exists
        cur.execute(
            """
            SELECT ticket_id
            FROM ticket_table
            WHERE ticket_id = %s
            AND archived_at IS NULL
            """,
            (ticket_id,),
        )
        if not cur.fetchone():
            return jsonify({"error": "Ticket not found or is archived"}), 404

        # If assigning (not unassigning), validate the assignee exists and is allowed
        if assigned_to is not None:
            cur.execute(
                """
                SELECT user_id
                FROM user_table
                WHERE user_id = %s
                  AND user_role IN ('technician', 'admin')
                """,
                (assigned_to,),
            )
            if not cur.fetchone():
                return jsonify({"error": "Invalid assignee"}), 400

        cur.execute(
            """
            UPDATE ticket_table
            SET assigned_to = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE ticket_id = %s
            """,
            (assigned_to, ticket_id),
        )

        conn.commit()
        return jsonify({"message": "Assignment updated"}), 200

    except psycopg2.Error as e:
        conn.rollback()
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
        cur.execute(
            """
            SELECT ticket_id
            FROM ticket_table
            WHERE ticket_id = %s
            AND archived_at IS NULL
            """,
            (ticket_id,),
        )
        if not cur.fetchone():
            return jsonify({"error": "Ticket not found or is archived"}), 404

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

        return (
            jsonify(
                {
                    "comment": {
                        "comment_id": new_comment["comment_id"],
                        "message": new_comment["message"],
                        "created_at": new_comment["created_at"],
                        "username": u["username"] if u else "unknown",
                    }
                }
            ),
            201,
        )

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


@tickets_bp.route("/tickets/<int:ticket_id>", methods=["PATCH"])
@login_required
@technician_required
def update_ticket(ticket_id):
    """
    Technician/admin can update ticket fields.
    Body can include: title, description, priority, status, assignedTo
    """
    data = request.get_json(silent=True) or {}

    allowed_status = {"open", "in_progress", "resolved"}
    title = data.get("title")
    description = data.get("description")
    priority = data.get("priority")
    status = data.get("status")
    assigned_to = data.get("assignedTo")

    updates = {}
    if title is not None:
        title = (title or "").strip()
        if not title:
            return jsonify({"error": "Title cannot be empty"}), 400
        updates["title"] = title

    if description is not None:
        description = (description or "").strip()
        if not description:
            return jsonify({"error": "Description cannot be empty"}), 400
        updates["description"] = description

    if priority is not None:
        priority = (priority or "").strip().lower()
        if priority not in VALID_PRIORITY:
            return jsonify({"error": "priority must be low, medium, or high"}), 400
        updates["priority"] = priority

    if status is not None:
        status = (status or "").strip().lower()
        if status not in allowed_status:
            return jsonify({"error": "status must be open, in_progress, or resolved"}), 400
        updates["status"] = status

    # assignedTo: allow null to unassign, int to assign
    if "assignedTo" in data:
        if assigned_to is None:
            updates["assigned_to"] = None
        else:
            try:
                assigned_to = int(assigned_to)
            except (TypeError, ValueError):
                return jsonify({"error": "assignedTo must be an integer or null"}), 400

            # validate assignee role
            conn = get_db_connection()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            try:
                cur.execute(
                    """
                    SELECT user_id
                    FROM user_table
                    WHERE user_id = %s
                      AND user_role IN ('technician', 'admin')
                    """,
                    (assigned_to,),
                )
                if not cur.fetchone():
                    return jsonify({"error": "Invalid assignee"}), 400
            finally:
                cur.close()
                conn.close()

            updates["assigned_to"] = assigned_to

    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # ensure ticket exists
        cur.execute(
            """
            SELECT ticket_id
            FROM ticket_table
            WHERE ticket_id = %s
            AND archived_at IS NULL
            """,
            (ticket_id,),
        )
        if not cur.fetchone():
            return jsonify({"error": "Ticket not found or is archived"}), 404

        # build dynamic SET clause safely
        set_parts = []
        values = []
        for k, v in updates.items():
            set_parts.append(f"{k} = %s")
            values.append(v)

        set_parts.append("updated_at = CURRENT_TIMESTAMP")
        values.append(ticket_id)

        cur.execute(
            f"""
            UPDATE ticket_table
            SET {", ".join(set_parts)}
            WHERE ticket_id = %s
            """,
            tuple(values),
        )

        # return updated ticket in the same shape your frontend expects
        cur.execute(
            """
            SELECT
              t.ticket_id AS id,
              t.title,
              t.description,
              t.priority,
              t.status,
              t.created_at AS "createdAt",
              creator.username AS "createdBy",
              t.assigned_to AS "assignedTo",
              t.archived_at AS "archivedAt",
              assignee.username AS "assignedUsername",
              assignee.user_role AS "assignedRole"
            FROM ticket_table t
            JOIN user_table creator ON creator.user_id = t.created_by
            LEFT JOIN user_table assignee ON assignee.user_id = t.assigned_to
            WHERE t.ticket_id = %s
            """,
            (ticket_id,),
        )

        r = cur.fetchone()
        conn.commit()

        ticket = {
            "id": r["id"],
            "title": r["title"],
            "description": r["description"],
            "priority": r["priority"],
            "status": r["status"],
            "createdBy": r["createdBy"],
            "createdAt": iso(r.get("createdAt")),
            "assignedTo": r.get("assignedTo"),
            "assignedUsername": r.get("assignedUsername"),
            "assignedRole": r.get("assignedRole"),
            "archivedAt": iso(r.get("archivedAt")),
        }

        return jsonify({"ticket": ticket}), 200

    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({"error": "Database error", "details": str(e)}), 500
    finally:
        cur.close()
        conn.close()
