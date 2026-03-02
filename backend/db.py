# db.py
import os
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor
from pathlib import Path

env_path = Path(__file__).resolve().parent / ".env"
loaded = load_dotenv(dotenv_path=env_path, override=True)


def get_db_connection():
    

    try:
        connection = psycopg2.connect(
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            dbname=os.getenv("DB_NAME"),
            sslmode=os.getenv("DB_SSLMODE", "require")  # required for Supabase/Neon
        )
        return connection
    except Exception as e:
        print(f"Database connection failed: {e}")
        raise
