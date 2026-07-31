from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.middleware.error_handlers import NotFoundError, ValidationAppError
from app.models.user import BlockedUser, User, UserReport
from app.schemas.common import MessageResponse
from app.schemas.user import UserMe, UserPublic, UserSearchResult, UserUpdateRequest
from app.services import storage_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.patch("/me", response_model=UserMe)
async def update_profile(
    payload: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's own profile fields (partial update)."""
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(current_user, field, value)
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=UserMe)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload/replace the current user's profile picture."""
    if file.content_type not in storage_service.ALLOWED_IMAGE_TYPES:
        raise ValidationAppError("Only JPEG, PNG, WEBP, or GIF images are allowed")

    public_url, _storage_path, _size, _mime = await storage_service.save_upload(file, category="avatars")
    current_user.avatar_url = public_url
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/search", response_model=List[UserSearchResult])
async def search_users(
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search users by username or full name (case-insensitive), excluding yourself."""
    pattern = f"%{q.lower()}%"
    result = await db.execute(
        select(User)
        .where(
            User.id != current_user.id,
            User.is_active.is_(True),
            or_(User.username.ilike(pattern), User.full_name.ilike(pattern)),
        )
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserPublic)
async def get_user_profile(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch another user's public profile."""
    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError("User not found")

    # Respect the target's last-seen privacy setting.
    if not user.show_last_seen:
        user.last_seen = None
    return user


@router.post("/{user_id}/block", response_model=MessageResponse)
async def block_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Block another user — they can no longer message you."""
    if user_id == current_user.id:
        raise ValidationAppError("You cannot block yourself")

    existing = await db.execute(
        select(BlockedUser).where(
            BlockedUser.blocker_id == current_user.id, BlockedUser.blocked_id == user_id
        )
    )
    if existing.scalar_one_or_none() is None:
        db.add(BlockedUser(blocker_id=current_user.id, blocked_id=user_id))
        await db.commit()
    return MessageResponse(message="User blocked")


@router.delete("/{user_id}/block", response_model=MessageResponse)
async def unblock_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unblock a previously blocked user."""
    result = await db.execute(
        select(BlockedUser).where(
            BlockedUser.blocker_id == current_user.id, BlockedUser.blocked_id == user_id
        )
    )
    blocked = result.scalar_one_or_none()
    if blocked is not None:
        await db.delete(blocked)
        await db.commit()
    return MessageResponse(message="User unblocked")


@router.post("/{user_id}/report", response_model=MessageResponse)
async def report_user(
    user_id: UUID,
    reason: str = Query(min_length=3, max_length=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a report against another user."""
    if user_id == current_user.id:
        raise ValidationAppError("You cannot report yourself")
    db.add(UserReport(reporter_id=current_user.id, reported_id=user_id, reason=reason))
    await db.commit()
    return MessageResponse(message="Report submitted")
