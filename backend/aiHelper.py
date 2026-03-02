from db import get_db_connection


###########################################
# GET SIMILAR TICKETS (AI Training Context)
###########################################

def get_similar_tickets(user_message):

    try:

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
        """
        SELECT title, description
        FROM ticket_table
        ORDER BY created_at DESC
        LIMIT 5
        """
        )

        tickets = cursor.fetchall()

        conn.close()

        results = []

        for t in tickets:

            results.append({
                "issue": t[0],
                "solution": t[1]
            })

        return results

    except Exception as e:

        print("Ticket search error:", e)

        return []


###########################################
# CREATE TICKET FROM AI
###########################################

def create_ticket_from_ai(user_id, issue_text):

    try:

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
        """
        INSERT INTO ticket_table
        (title, description, status, priority, created_by)
        VALUES (%s,%s,%s,%s,%s)
        RETURNING ticket_id
        """,
        (
            "AI Generated Ticket",
            issue_text,
            "Open",
            "Medium",
            user_id
        )
        )

        result = cursor.fetchone()

        conn.commit()
        conn.close()

        if result:
            return result[0]

        return None

    except Exception as e:

        print("Ticket create error:", e)

        return None


###########################################
# GET LATEST TICKET STATUS
###########################################

def get_latest_ticket(user_id):

    try:

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
        """
        SELECT ticket_id,title,description,status
        FROM ticket_table
        WHERE created_by = %s
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (user_id,)
        )

        ticket = cursor.fetchone()

        conn.close()

        if ticket:

            return {
                "id": ticket[0],
                "title": ticket[1],
                "description": ticket[2],
                "status": ticket[3]
            }

        return None

    except Exception as e:

        print("Status error:", e)

        return None


###########################################
# CREATE GUEST TICKET (REAL DATABASE)
###########################################

def create_guest_ticket(name, contact, issue):

    try:

        conn = get_db_connection()
        cursor = conn.cursor()

        title_text = f"{name} | {contact}"

        cursor.execute(
        """
        INSERT INTO ticket_table
        (title, description, status, priority, created_by)
        VALUES (%s,%s,%s,%s,%s)
        RETURNING ticket_id
        """,
        (
            title_text,
            issue,
            "Open",
            "Medium",
            1
        )
        )

        result = cursor.fetchone()

        conn.commit()
        conn.close()

        if result:
            return result[0]

        return None

    except Exception as e:

        print("Guest ticket error:", e)

        return None


###########################################
# GET TICKET BY NAME + ID
###########################################

def get_ticket_by_name_and_id(username, ticket_id):

    try:

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
        """
        SELECT t.ticket_id, t.description, t.status
        FROM ticket_table t
        JOIN user_table u
        ON t.created_by = u.user_id
        WHERE LOWER(u.username) = LOWER(%s)
        AND t.ticket_id = %s
        """,
        (username, ticket_id)
        )

        ticket = cursor.fetchone()

        conn.close()

        if ticket:

            return {
                "id": ticket[0],
                "description": ticket[1],
                "status": ticket[2]
            }

        return None

    except Exception as e:

        print("Ticket lookup error:", e)

        return None