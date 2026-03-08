# notifications_routes.py
from flask import Blueprint, jsonify, session, request
from db import get_db_connection

notifications_bp = Blueprint("notifications", __name__)

def require_login():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "Unauthorized"}), 401)
    return uid, None

@notifications_bp.get("/notifications")
def list_notifications():
    user_id, err = require_login()
    if err:
        return err

    limit = int(request.args.get("limit", 20))
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT notification_id, type, message, link, is_read, created_at
                FROM notification_table
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (user_id, limit),
            )
            rows = cur.fetchall()

        notifications = [
            {
                "id": r["notification_id"],
                "type": r["type"],
                "message": r["message"],
                "link": r["link"],
                "isRead": r["is_read"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]
        return jsonify({"notifications": notifications})
    finally:
        conn.close()

@notifications_bp.post("/notifications/<int:notification_id>/read")
def mark_read(notification_id):
    user_id, err = require_login()
    if err:
        return err

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE notification_table
                SET is_read = TRUE
                WHERE notification_id = %s AND user_id = %s
                """,
                (notification_id, user_id),
            )
        conn.commit()
        return jsonify({"ok": True})
    finally:
        conn.close()