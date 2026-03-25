from fastapi import Header, HTTPException
from uuid import UUID

def get_current_user_id(authorization: str = Header(None)) -> UUID:

    # Replace with a real user id once auth is wired. decode supabase JWT from auth header
    try:
        return UUID("00000000-0000-0000-0000-000000000001")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user")
