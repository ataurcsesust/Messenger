"""
Password hashing and JWT token creation/verification utilities.

Kept framework-agnostic (no FastAPI imports) so it can be unit tested or
reused by background workers without pulling in the whole app.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
def hash_password(plain_password: str) -> str:
    """Hash a plaintext password with bcrypt."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Check a plaintext password against its bcrypt hash."""
    return pwd_context.verify(plain_password, password_hash)


# ---------------------------------------------------------------------------
# JWT access tokens
# ---------------------------------------------------------------------------
def create_access_token(user_id: UUID, extra_claims: Optional[dict] = None) -> str:
    """
    Create a short-lived JWT access token. `sub` is the user id; `type`
    distinguishes access tokens from refresh tokens if a refresh token
    were ever mistakenly presented to an access-only endpoint.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": expire,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and validate an access token. Raises jose.JWTError on any
    failure (expired, bad signature, malformed) — callers should catch
    this and translate it into an HTTP 401.
    """
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != "access":
        raise JWTError("Invalid token type")
    return payload


# ---------------------------------------------------------------------------
# Refresh tokens
# ---------------------------------------------------------------------------
def generate_refresh_token() -> Tuple[str, str, datetime]:
    """
    Generate a high-entropy opaque refresh token.

    Returns (raw_token, token_hash, expires_at). The raw token is sent to
    the client (e.g. as an httpOnly cookie); only the SHA-256 hash is
    persisted in the DB, so a DB leak alone can't be used to log in.
    """
    raw_token = secrets.token_urlsafe(64)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return raw_token, token_hash, expires_at


def hash_refresh_token(raw_token: str) -> str:
    """Hash a raw refresh token the same way generate_refresh_token does, for lookup."""
    return hashlib.sha256(raw_token.encode()).hexdigest()
