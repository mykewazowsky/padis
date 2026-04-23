import psycopg2
import os
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv()


def get_conn():
    """
    Connect ke Supabase pakai DATABASE_URL
    """
    try:
        db_url = os.getenv("DATABASE_URL")

        if not db_url:
            raise ValueError("DATABASE_URL tidak ditemukan di .env")

        # 🔥 FIX: remove prefix yang tidak didukung psycopg2
        db_url = db_url.replace("postgresql+psycopg://", "postgresql://")

        result = urlparse(db_url)

        conn = psycopg2.connect(
            dbname=result.path[1:],
            user=result.username,
            password=result.password,
            host=result.hostname,
            port=result.port,
            sslmode="require"
        )

        return conn

    except Exception as e:
        print("❌ ERROR connecting to database:")
        print(e)
        raise


def test_connection():
    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("SELECT 1;")
        print("✅ Connected to Supabase!")

        cur.close()
        conn.close()

    except Exception as e:
        print("❌ Connection failed:", e)
