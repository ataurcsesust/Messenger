"""
Business logic for authentication. Kept separate from the router so the
HTTP layer stays thin (parse request -> call service -> shape response)
and this logic is unit-testable without spinning up FastAPI.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.config import settings
from app.middleware.error_handlers import ConflictError, UnauthorizedError
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import RegisterRequest


async def register_user(db: AsyncSession, payload: RegisterRequest) -> User:
    """Create a new user account, rejecting duplicate email/username up front."""
    existing = await db.execute(
        select(User).where(or_(User.email == payload.email, User.username == payload.username))
    )
    if existing.scalar_one_or_none() is not None:
        raise ConflictError("An account with this email or username already exists")

    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, identifier: str, password: str) -> User:
    """Verify credentials (email or username + password); raise 401 on any mismatch."""
    result = await db.execute(
        select(User).where(or_(User.email == identifier.lower(), User.username == identifier.lower()))
    )
    user = result.scalar_one_or_none()

    # Always run verify_password even on a missing user to avoid leaking
    # via response-time whether an account exists (timing side channel).
    if user is None:
        verify_password(password, "$2b$12$" + "x" * 53)
        raise UnauthorizedError("Invalid credentials")

    if not verify_password(password, user.password_hash):
        raise UnauthorizedError("Invalid credentials")

    if not user.is_active:
        raise UnauthorizedError("Account has been deactivated")

    return user


async def issue_tokens(db: AsyncSession, user: User, device_info: Optional[str] = None) -> tuple[str, str]:
    """Issue a fresh (access_token, refresh_token) pair and persist the refresh token's hash."""
    access_token = create_access_token(user.id)

    raw_refresh, token_hash, expires_at = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            device_info=device_info or "unknown",
            expires_at=expires_at,
        )
    )
    await db.commit()
    return access_token, raw_refresh


async def rotate_refresh_token(db: AsyncSession, raw_refresh_token: str) -> tuple[str, str, User]:
    """
    Validate an incoming refresh token, revoke it, and issue a brand new
    access+refresh pair (refresh token rotation limits the blast radius
    of a leaked token).
    """
    token_hash = hash_refresh_token(raw_refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()

    if stored is None or stored.is_revoked:
        raise UnauthorizedError("Invalid refresh token")

    if stored.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise UnauthorizedError("Refresh token has expired")

    user_result = await db.execute(select(User).where(User.id == stored.user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise UnauthorizedError("Account not found or deactivated")

    # Revoke the old token (rotation) then issue new ones.
    stored.is_revoked = True
    await db.commit()

    access_token, new_refresh = await issue_tokens(db, user, stored.device_info)
    return access_token, new_refresh, user


async def revoke_refresh_token(db: AsyncSession, raw_refresh_token: str) -> None:
    """Logout: revoke the given refresh token so it can't be used again."""
    token_hash = hash_refresh_token(raw_refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()
    if stored is not None:
        stored.is_revoked = True
        await db.commit()


async def revoke_all_user_tokens(db: AsyncSession, user_id: UUID) -> None:
    """Logout of all devices — revoke every active refresh token for this user."""
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.is_revoked.is_(False))
    )
    for token in result.scalars().all():
        token.is_revoked = True
    await db.commit()
