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


def _decode_token(authorization: str) -> dict:
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
        return jwt.decode(
            token, jwks, algorithms=["ES256"], options={"verify_aud": False}
        )

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user_id(authorization: str = Header(None)) -> UUID:
    payload = _decode_token(authorization)
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing sub claim")
    try:
        return UUID(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid sub claim")


def get_current_jwt_payload(authorization: str = Header(None)) -> dict:
    return _decode_token(authorization)


def require_manager(
    authorization: str = Header(None),) -> UUID:

    user_id = get_current_user_id(authorization)

    with get_db() as (conn, cur):
        cur.execute(
            "SELECT role FROM public.profiles WHERE id = %(user_id)s",
            {"user_id": str(user_id)},
        )
        row = cur.fetchone()

    if not row or row["role"] != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")

    return user_id