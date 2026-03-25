import os
from contextlib import contextmanager

from dotenv import load_dotenv
import psycopg

load_dotenv()

DATABASE_URL = os.getenv("SUPABASE_DB_URL")
if not DATABASE_URL:
    raise RuntimeError("SUPABASE_DB_URL is not set in .env")

@contextmanager
def get_db():
    # psycopg 3 connection
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            yield conn, cur
