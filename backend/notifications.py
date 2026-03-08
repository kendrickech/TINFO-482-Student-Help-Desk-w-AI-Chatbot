# notifications.py
# from datetime import datetime

def create_notification(conn, user_id, type_, message, link=None):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO notification_table (user_id, type, message, link)
            VALUES (%s, %s, %s, %s)
            """,
            (user_id, type_, message, link),
        )