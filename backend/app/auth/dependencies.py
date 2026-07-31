from uuid import UUID

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import decode_access_token
from app.database.session import get_db
from app.middleware.error_handlers import UnauthorizedError
from app.models.user import User

# tokenUrl is only used for OpenAPI docs' "Authorize" button; the actual
# endpoint lives under the versioned prefix (see routers/auth.py).
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Resolve the caller's User from the `Authorization: Bearer <token>`
    header. Raises 401 for any missing/invalid/expired token or if the
    account has been deactivated.
    """
    if token is None:
        raise UnauthorizedError("Missing authentication token")

    try:
        payload = decode_access_token(token)
        user_id = UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise UnauthorizedError("Invalid or expired authentication token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedError("User not found")
    if not user.is_active:
        raise UnauthorizedError("Account has been deactivated")

    return user


async def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    """Alias kept for readability at call sites that care about 'active' semantics."""
    return user
