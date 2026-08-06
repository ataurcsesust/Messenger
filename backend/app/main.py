"""
Application entrypoint.

Run with:  uvicorn app.main:app --reload
Docs at:   http://localhost:8000/docs  (Swagger)
           http://localhost:8000/redoc (ReDoc)
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.middleware.error_handlers import register_exception_handlers
from app.middleware.rate_limit import limiter
from app.routers import auth as auth_router
from app.routers import calls as calls_router
from app.routers import conversations as conversations_router
from app.routers import messages as messages_router
from app.routers import notifications as notifications_router
from app.routers import users as users_router
from app.websocket import routes as websocket_router

logging.basicConfig(level=logging.INFO if not settings.DEBUG else logging.DEBUG)
logger = logging.getLogger("messenger")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s in %s mode", settings.APP_NAME, settings.APP_ENV)
    yield
    logger.info("Shutting down %s", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "REST + WebSocket API for a Messenger-style real-time chat application. "
        "Supports 1:1 and group messaging, attachments, read receipts, reactions, "
        "typing indicators, and notifications."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
if settings.APP_ENV == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error_code": "RATE_LIMITED",
            "message": "Too many requests. Please slow down and try again shortly.",
            "details": None,
        },
    )


register_exception_handlers(app)

# ---------------------------------------------------------------------------
# Static file serving for locally-stored uploads (avatars, attachments).
# Swappable for S3/CloudFront later without touching the rest of the app.
# ---------------------------------------------------------------------------
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(users_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(conversations_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(messages_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(notifications_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(calls_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(websocket_router.router)


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "app": settings.APP_NAME, "version": "0.1.0"}


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}
