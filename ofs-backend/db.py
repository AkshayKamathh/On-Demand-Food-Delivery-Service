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
    # prepare_threshold=None disables psycopg3's implicit server-side prepared
    # statements. Required because Supabase's transaction-mode pooler recycles
    # backends across connections, and a backend can already hold a prepared
    # statement named "_pg3_0" from a prior client — causing
    # DuplicatePreparedStatement on the next checkout.
    with psycopg.connect(DATABASE_URL, prepare_threshold=None) as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            yield conn, cur
