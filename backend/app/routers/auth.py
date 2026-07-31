from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.security import hash_password, verify_password
from app.config import settings
from app.database.session import get_db
from app.middleware.error_handlers import UnauthorizedError
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.common import MessageResponse
from app.schemas.user import UserMe
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserMe, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create a new user account. Email and username must both be unique."""
    user = await auth_service.register_user(db, payload)
    return user


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate with email-or-username + password. Returns a short-lived
    access token plus a long-lived refresh token. Rate-limited to slow
    brute-force attempts.
    """
    user = await auth_service.authenticate_user(db, payload.identifier, payload.password)
    access_token, refresh_token = await auth_service.issue_tokens(
        db, user, device_info=request.headers.get("user-agent")
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a valid refresh token for a new access+refresh pair (rotation)."""
    access_token, new_refresh_token, _ = await auth_service.rotate_refresh_token(db, payload.refresh_token)
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(payload: LogoutRequest, db: AsyncSession = Depends(get_db)):
    """Revoke a single refresh token (log out of this device)."""
    await auth_service.revoke_refresh_token(db, payload.refresh_token)
    return MessageResponse(message="Logged out successfully")


@router.post("/logout-all", response_model=MessageResponse)
async def logout_all(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Revoke every refresh token belonging to the current user (log out of all devices)."""
    await auth_service.revoke_all_user_tokens(db, current_user.id)
    return MessageResponse(message="Logged out of all devices")


@router.get("/me", response_model=UserMe)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's own profile."""
    return current_user


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the current user's password after verifying the old one."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise UnauthorizedError("Current password is incorrect")

    current_user.password_hash = hash_password(payload.new_password)
    db.add(current_user)
    await db.commit()

    # Security best practice: invalidate all existing sessions after a password change.
    await auth_service.revoke_all_user_tokens(db, current_user.id)
    return MessageResponse(message="Password changed successfully. Please log in again.")
