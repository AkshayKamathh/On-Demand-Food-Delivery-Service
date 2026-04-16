from fastapi import Header, HTTPException
from uuid import UUID
from jose import jwt, JWTError
import os
import requests
import time
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


def get_current_user_id(authorization: str = Header(None)) -> UUID:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")

        if alg != "ES256":
            raise HTTPException(status_code=401, detail="Unsupported token algorithm")

        if not SUPABASE_URL:
            raise HTTPException(status_code=500, detail="SUPABASE_URL is not set")

        jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        jwks = _get_jwks(jwks_url)

        payload = jwt.decode(
            token,
            jwks,
            algorithms=["ES256"],
            options={"verify_aud": False},
        )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token missing sub claim")

        return UUID(user_id)

    except HTTPException:
        raise
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")