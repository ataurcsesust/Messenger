"""
Global rate limiting via slowapi (a Flask-Limiter-style wrapper around
FastAPI). Limits are keyed by client IP; stricter per-route limits (e.g.
on /auth/login to slow brute force) can be added with the `@limiter.limit`
decorator on individual routes.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
)
