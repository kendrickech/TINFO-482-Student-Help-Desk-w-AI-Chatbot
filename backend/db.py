# db.py
import os
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_connection():
    """
    Returns a new PostgreSQL connection.
    RealDictCursor makes query results behave like dictionaries:
    row["email"] instead of row[0]
    """
    """return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        dbname=os.getenv("DB_NAME", "helpdesk"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "password"),
        cursor_factory=RealDictCursor,
    )"""
    return psycopg2.connect(
        dbname="helpdesk",
        user="postgres",
        password="newpass123",
        host="localhost",
        port=5432,
    )