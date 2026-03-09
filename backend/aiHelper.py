from psycopg2.extras import RealDictCursor
from db import get_db_connection


def get_similar_tickets(user_message):
    conn = None
    try:
        conn = get_db_connection()

        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            search_term = f"%{user_message.strip()}%"

            cursor.execute(
                """
                SELECT ticket_id, title, description, status, priority, created_at
                FROM ticket_table
                WHERE archived_at IS NULL
                  AND (
                        LOWER(title) LIKE LOWER(%s)
                        OR LOWER(description) LIKE LOWER(%s)
                  )
                ORDER BY created_at DESC
                LIMIT 5
                """,
                (search_term, search_term)
            )

            tickets = cursor.fetchall()

            return [
                {
                    "issue": f"{t['title']} - {t['description']}",
                    "solution": f"Status: {t['status']}, Priority: {t['priority']}"
                }
                for t in tickets
            ]

    except Exception as e:
        print("Ticket search error:", e)
        return []

    finally:
        if conn:
            conn.close()


def create_ticket_from_ai(user_id, title, description, priority="medium"):
    conn = None

    try:
        conn = get_db_connection()

        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                INSERT INTO ticket_table
                (title, description, status, priority, created_by)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING ticket_id
                """,
                (
                    title,
                    description,
                    "open",
                    priority,
                    user_id
                )
            )

            result = cursor.fetchone()
            conn.commit()

            return result["ticket_id"] if result else None

    except Exception as e:
        print("Ticket create error:", e)
        if conn:
            conn.rollback()
        return None

    finally:
        if conn:
            conn.close()


def get_latest_ticket(user_id):
    conn = None
    try:
        conn = get_db_connection()

        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT ticket_id, title, description, status, priority, created_at
                FROM ticket_table
                WHERE created_by = %s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user_id,)
            )

            ticket = cursor.fetchone()

            if not ticket:
                return None

            return {
                "id": ticket["ticket_id"],
                "title": ticket["title"],
                "description": ticket["description"],
                "status": ticket["status"],
                "priority": ticket["priority"],
                "created_at": str(ticket["created_at"]) if ticket["created_at"] else None,
            }

    except Exception as e:
        print("Status error:", e)
        return None

    finally:
        if conn:
            conn.close()


def get_ticket_by_user_id_and_id(user_id, ticket_id):
    conn = None
    try:
        conn = get_db_connection()

        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT ticket_id, title, description, status, priority
                FROM ticket_table
                WHERE ticket_id = %s
                  AND created_by = %s
                """,
                (ticket_id, user_id)
            )

            ticket = cursor.fetchone()

            if not ticket:
                return None

            return {
                "id": ticket["ticket_id"],
                "title": ticket["title"],
                "description": ticket["description"],
                "status": ticket["status"],
                "priority": ticket["priority"],
            }

    except Exception as e:
        print("Ticket lookup by user_id error:", e)
        return None

    finally:
        if conn:
            conn.close()