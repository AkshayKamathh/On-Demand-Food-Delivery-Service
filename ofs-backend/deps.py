from fastapi import Header, HTTPException, Depends
from uuid import UUID
from jose import jwt, JWTError
import os
import requests
import time
from db import get_db
import threading

SUPABASE_URL = os.getenv("SUPABASE_URL")

JWKS_CACHE = {"jwks": None, "expires_at": 0.0}
JWKS_LOCK = threading.Lock()
JWKS_TTL_SECONDS = 3600


def _get_jwks(jwks_url: str) -> dict:
    now = time.time()
    with JWKS_LOCK:
        cached = JWKS_CACHE.get("jwks")
        expires_at = JWKS_CACHE.get("expires_at", 0.0)
        if cached is not None and now < expires_at:
            return cached

        jwks = requests.get(jwks_url, timeout=10).json()
        JWKS_CACHE["jwks"] = jwks
        JWKS_CACHE["expires_at"] = now + JWKS_TTL_SECONDS
        return jwks


def get_current_user_id(authorization: str = Header(None)) -> dict:
    """Validates the JWT and returns the full payload (works for users and managers)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        header = jwt.get_unverified_header(token)
        if header.get("alg") != "ES256":
            raise HTTPException(status_code=401, detail="Unsupported token algorithm")

        if not SUPABASE_URL:
            raise HTTPException(status_code=500, detail="SUPABASE_URL is not set")

        jwks = _get_jwks(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
        payload = jwt.decode(
            token, jwks, algorithms=["ES256"], options={"verify_aud": False}
        )
        return payload

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_user(payload: dict = Depends(get_current_user_id)) -> UUID:
    """Extracts and returns the user UUID from the JWT payload."""
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing subject claim")
    try:
        return UUID(sub)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID in token")


def require_manager(payload: dict = Depends(get_current_user_id)) -> UUID:
    """Ensures the token belongs to a manager and returns their UUID."""
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing subject claim")
    try:
        user_id = UUID(sub)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID in token")

    with get_db() as (conn, cur):
        cur.execute(
            "SELECT role FROM public.profiles WHERE id = %(user_id)s",
            {"user_id": str(user_id)},
        )
        row = cur.fetchone()

    if not row or row["role"] != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")

    return user_id