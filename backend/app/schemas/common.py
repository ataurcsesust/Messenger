from typing import Any, Optional

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """Consistent error shape returned by every failure path in the API."""
    success: bool = False
    error_code: str
    message: str
    details: Optional[Any] = None


class MessageResponse(BaseModel):
    """Simple ack response for actions with no meaningful return payload."""
    success: bool = True
    message: str
