from flask import Blueprint, request, jsonify, session
from psycopg2.extras import RealDictCursor
from datetime import datetime
import psycopg2

from db import get_db_connection
from auth import login_required, admin_required, technician_required

tickets_bp = Blueprint("tickets", __name__)

VALID_PRIORITY = {"low", "medium", "high"}
VALID_STATUS = {"open", "in_progress", "resolved"}

def iso(dt):
    return dt.isoformat() if isinstance(dt, datetime) else None

def format_status(status):
    if not status:
        return ""
    return status.replace("_", " ").title()

def notify_users(cur, user_ids, notif_type, message, link=None, exclude_user_id=None):
    seen = set()

    for uid in user_ids:
        if not uid:
            continue
        if exclude_user_id is not None and uid == exclude_user_id:
            continue
        if uid in seen:
            continue

        create_notification(cur, uid, notif_type, message, link)
        seen.add(uid)

def create_notification(cur, user_id, notif_type, message, link=None):
    cur.execute(
        """
        INSERT INTO notification_table (user_id, type, message, link, is_read, created_at)
        VALUES (%s, %s, %s, %s, FALSE, CURRENT_TIMESTAMP)
        """,
        (user_id, notif_type, message, link),
    )

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
                  creator.username AS "createdBy",
                  t.assigned_to AS "assignedTo",
                  assignee.username AS "assignedUsername",
                  assignee.user_role AS "assignedRole"
                FROM ticket_table t
                JOIN user_table creator ON creator.user_id = t.created_by
                LEFT JOIN user_table assignee ON assignee.user_id = t.assigned_to
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
                  creator.username AS "createdBy",
                  t.assigned_to AS "assignedTo",
                  assignee.username AS "assignedUsername",
                  assignee.user_role AS "assignedRole"
                FROM ticket_table t
                JOIN user_table creator ON creator.user_id = t.created_by
                LEFT JOIN user_table assignee ON assignee.user_id = t.assigned_to
                WHERE t.created_by = %s
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
                    "priorityDisplay": r["priority"].title(),
                    "status": r["status"],
                    "statusDisplay": format_status(r["status"]),
                    "createdBy": r["createdBy"],
                    "createdAt": iso(r.get("createdAt")),
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

        # Notify admins and technicians about the new ticket
        cur.execute(
            """
            SELECT user_id
            FROM user_table
            WHERE user_role IN ('admin', 'technician')
            """
        )
        staff_rows = cur.fetchall()

        notif_message = f"New ticket #{inserted['id']} was created by {username}"
        link = f"/tickets/{inserted['id']}"

        notify_users(
            cur,
            [row["user_id"] for row in staff_rows],
            "ticket_created",
            notif_message,
            link,
            exclude_user_id=created_by,
        )

        conn.commit()

        return (
            jsonify(
                {
                    "ticket": {
                        "id": inserted["id"],
                        "title": title,
                        "description": description,
                        "priority": priority,
                        "status": status,
                        "statusDisplay": format_status(status),
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
            "statusDisplay": format_status(r["status"]),
            "createdBy": r["createdBy"],
            "createdAt": iso(r.get("createdAt")),
            "assignedTo": r.get("assignedTo"),
            "assignedUsername": r.get("assignedUsername"),
            "assignedRole": r.get("assignedRole"),
        }

        return jsonify({"ticket": ticket}), 200

    except psycopg2.Error as e:
        return jsonify({"error": "Database error", "details": str(e)}), 500

    finally:
        cur.close()
        conn.close()


@tickets_bp.route("/assignees", methods=["GET"])
@login_required
@admin_required
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
def assign_ticket(ticket_id):
    data = request.get_json(silent=True) or {}
    assigned_to = data.get("assignedTo", None)

    actor_id = session.get("user_id")
    actor_role = session.get("user_role")

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute(
            """
            SELECT ticket_id, created_by, assigned_to, title
            FROM ticket_table
            WHERE ticket_id = %s
            """,
            (ticket_id,),
        )
        ticket = cur.fetchone()

        if not ticket:
            return jsonify({"error": "Ticket not found"}), 404

        old_assigned_to = ticket["assigned_to"]

        # Admin can assign/unassign any ticket
        if actor_role == "admin":
            allowed = True

        # Technician can:
        # - claim an unassigned ticket for themselves
        # - unclaim a ticket assigned to themselves
        elif actor_role == "technician":
            claiming_self = assigned_to == actor_id and old_assigned_to is None
            unclaiming_self = assigned_to is None and old_assigned_to == actor_id
            allowed = claiming_self or unclaiming_self

        else:
            allowed = False

        if not allowed:
            return jsonify({"error": "You do not have permission to change this assignment"}), 403

        assignee_info = None
        if assigned_to is not None:
            cur.execute(
                """
                SELECT user_id, username, user_role
                FROM user_table
                WHERE user_id = %s
                  AND user_role IN ('technician', 'admin')
                """,
                (assigned_to,),
            )
            assignee_info = cur.fetchone()

            if not assignee_info:
                return jsonify({"error": "Invalid assignee"}), 400

        cur.execute(
            """
            UPDATE ticket_table
            SET assigned_to = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE ticket_id = %s
            RETURNING ticket_id AS id
            """,
            (assigned_to, ticket_id),
        )
        updated = cur.fetchone()

        link = f"/tickets/{ticket_id}"

        if assigned_to is None:
            message = f"Ticket #{ticket_id} was unassigned"
            notify_users(
                cur,
                [ticket["created_by"], old_assigned_to],
                "ticket_assignment",
                message,
                link,
                exclude_user_id=actor_id,
            )
        else:
            message = f"Ticket #{ticket_id} was assigned to {assignee_info['username']}"
            notify_users(
                cur,
                [ticket["created_by"], assigned_to, old_assigned_to],
                "ticket_assignment",
                message,
                link,
                exclude_user_id=actor_id,
            )

        # return the refreshed ticket
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
              assignee.username AS "assignedUsername",
              assignee.user_role AS "assignedRole"
            FROM ticket_table t
            JOIN user_table creator ON creator.user_id = t.created_by
            LEFT JOIN user_table assignee ON assignee.user_id = t.assigned_to
            WHERE t.ticket_id = %s
            """,
            (ticket_id,),
        )
        full_ticket = cur.fetchone()

        conn.commit()

        return jsonify({
            "message": "Assignment updated",
            "ticket": {
                "id": full_ticket["id"],
                "title": full_ticket["title"],
                "description": full_ticket["description"],
                "priority": full_ticket["priority"],
                "priorityDisplay": full_ticket["priority"].title(),
                "status": full_ticket["status"],
                "statusDisplay": format_status(full_ticket["status"]),
                "createdBy": full_ticket["createdBy"],
                "createdAt": iso(full_ticket.get("createdAt")),
                "assignedTo": full_ticket.get("assignedTo"),
                "assignedUsername": full_ticket.get("assignedUsername"),
                "assignedRole": full_ticket.get("assignedRole"),
            }
        }), 200

    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({"error": "Database error", "details": str(e)}), 500

    finally:
        cur.close()
        conn.close()


@tickets_bp.route("/tickets/<int:ticket_id>/priority", methods=["PATCH"])
@login_required
def update_ticket_priority(ticket_id):
    user_id = session.get("user_id")
    user_role = session.get("user_role")
    data = request.get_json(silent=True) or {}

    new_priority = (data.get("priority") or "").strip().lower()

    if new_priority not in VALID_PRIORITY:
        return jsonify({"error": "priority must be low, medium, or high"}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Get ticket info
        cur.execute(
            """
            SELECT ticket_id, priority, created_by, assigned_to
            FROM ticket_table
            WHERE ticket_id = %s
            """,
            (ticket_id,),
        )
        ticket = cur.fetchone()

        if not ticket:
            return jsonify({"error": "Ticket not found"}), 404

        # Permission logic
        if user_role == "admin":
            allowed = True
        elif user_role == "technician":
            allowed = ticket.get("assigned_to") == user_id
        else:
            allowed = ticket.get("created_by") == user_id

        if not allowed:
            return jsonify({"error": "You do not have permission to update this ticket"}), 403

        old_priority = ticket["priority"]

        if old_priority == new_priority:
            return jsonify({
                "message": "Priority unchanged",
                "ticket": {
                    "id": ticket_id,
                    "priority": new_priority,
                    "priorityDisplay": new_priority.title(),
                }
            }), 200

        # Update the ticket
        cur.execute(
            """
            UPDATE ticket_table
            SET priority = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE ticket_id = %s
            RETURNING ticket_id AS id, priority
            """,
            (new_priority, ticket_id),
        )
        updated = cur.fetchone()

        # Create notification message
        message = f"Ticket #{ticket_id} priority changed to {new_priority.title()}"
        link = f"/tickets/{ticket_id}"

        notify_users(
            cur,
            [ticket["created_by"], ticket["assigned_to"]],
            "ticket_priority",
            message,
            link,
            exclude_user_id=user_id,
        )

        conn.commit()

        return jsonify({
            "message": "Priority updated",
            "ticket": {
                "id": updated["id"],
                "priority": updated["priority"],
                "priorityDisplay": updated["priority"].title(),
            }
        }), 200

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
        # Ensure ticket exists and get related users
        cur.execute(
            """
            SELECT ticket_id, created_by, assigned_to, title
            FROM ticket_table
            WHERE ticket_id = %s
            """,
            (ticket_id,),
        )
        ticket = cur.fetchone()

        if not ticket:
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
        username = u["username"] if u else "unknown"

        notif_message = f"{username} commented on Ticket #{ticket_id}"
        link = f"/tickets/{ticket_id}"

        notify_users(
            cur,
            [ticket["created_by"], ticket["assigned_to"]],
            "ticket_comment",
            notif_message,
            link,
            exclude_user_id=user_id,
        )

        conn.commit()

        return (
            jsonify(
                {
                    "comment": {
                        "comment_id": new_comment["comment_id"],
                        "message": new_comment["message"],
                        "created_at": new_comment["created_at"],
                        "username": username,
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
@technician_required  # keep this if it includes admin too
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
              AND status = 'resolved'
            RETURNING ticket_id AS id, archived_at
            """,
            (ticket_id,),
        )
        row = cur.fetchone()
        conn.commit()

        if not row:
            return jsonify({"error": "Only resolved, unarchived tickets can be archived"}), 400

        return jsonify({"ok": True, "ticket": row}), 200
    finally:
        cur.close()
        conn.close()


@tickets_bp.route("/tickets/<int:ticket_id>/unarchive", methods=["PATCH"])
@login_required
@admin_required
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
        row = cur.fetchone()
        conn.commit()

        if not row:
            return jsonify({"error": "Ticket not found or not archived"}), 404

        return jsonify({"ok": True, "ticket": row}), 200
    finally:
        cur.close()
        conn.close()

@tickets_bp.route("/tickets/search-tickets", methods=["GET"])
@login_required
@admin_required
def search_tickets():

    search_value = request.args.get("query")

    if not search_value:
        return jsonify({"message": "Search query required"}), 400

    conn = get_db_connection()
    curr = conn.cursor(cursor_factory=RealDictCursor)

    curr.execute("""
        SELECT 
            t.ticket_id as id,
            t.title,
            t.description,
            t.status,
            t.priority,
            t.created_at,
            u.email,
            u.user_id
        FROM ticket_table t
        JOIN user_table u ON t.created_by = u.user_id
        WHERE u.email ILIKE %s
        OR CAST(u.user_id AS TEXT) ILIKE %s
        ORDER BY t.created_at DESC
    """, (f"%{search_value}%", f"%{search_value}%"))

    tickets = curr.fetchall()

    for t in tickets:
        t["statusDisplay"] = format_status(t["status"])
        t["priorityDisplay"] = t["priority"].title()

    curr.close()
    conn.close()

    # RETURN ARRAY (important for frontend)
    return jsonify(tickets), 200

@tickets_bp.route("/tickets/<int:ticket_id>/status", methods=["PATCH"])
@login_required
def update_ticket_status(ticket_id):
    user_id = session.get("user_id")
    user_role = session.get("user_role")
    data = request.get_json(silent=True) or {}

    new_status = (data.get("status") or "").strip().lower()

    if new_status not in VALID_STATUS:
        return jsonify({"error": "status must be open, in_progress, or resolved"}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Get current ticket info first
        cur.execute(
            """
            SELECT ticket_id, status, created_by, assigned_to
            FROM ticket_table
            WHERE ticket_id = %s
            """,
            (ticket_id,),
        )
        ticket = cur.fetchone()

        if not ticket:
            return jsonify({"error": "Ticket not found"}), 404

        # Permission rule:
        # admin can update any ticket
        # technician can update tickets assigned to them
        # student/user can update their own tickets only if you want that behavior
        if user_role == "admin":
            allowed = True
        elif user_role == "technician":
            allowed = ticket.get("assigned_to") == user_id
        else:
            allowed = ticket.get("created_by") == user_id

        if not allowed:
            return jsonify({"error": "You do not have permission to update this ticket"}), 403

        old_status = ticket["status"]

        # If nothing changed, return success without updating
        if old_status == new_status:
            return jsonify({
                "message": "Status unchanged",
                "ticket": {
                    "id": ticket_id,
                    "status": new_status,
                    "statusDisplay": format_status(new_status),
                }
            }), 200

        # Update ticket status
        cur.execute(
            """
            UPDATE ticket_table
            SET status = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE ticket_id = %s
            RETURNING ticket_id AS id, status
            """,
            (new_status, ticket_id),
        )
        updated = cur.fetchone()

        # Create notification for the ticket creator
        # You can expand this later to notify assignee too if needed
        message = f"Ticket #{ticket_id} status changed to {new_status.replace('_', ' ').title()}"
        link = f"/tickets/{ticket_id}"

        notify_users(
            cur,
            [ticket["created_by"], ticket["assigned_to"]],
            "ticket_status",
            message,
            link,
            exclude_user_id=user_id,
        )

        conn.commit()

        return jsonify({
            "message": "Status updated",
            "ticket": {
                "id": updated["id"],
                "status": updated["status"],
                "statusDisplay": format_status(updated["status"]),
            }
        }), 200

    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({"error": "Database error", "details": str(e)}), 500

    finally:
        cur.close()
        conn.close()

