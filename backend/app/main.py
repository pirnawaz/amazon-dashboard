import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.api.routes.health import router as health_router
from app.api.routes.auth import router as auth_router
from app.api.routes.me import router as me_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.dashboard_analytics import router as dashboard_analytics_router

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title="Amazon Dashboard API", version="0.1.0")

# CORS: in development allow any localhost/127.0.0.1 port via regex; otherwise lock to frontend_origin
if settings.app_env == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1):\d+$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(me_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(dashboard_analytics_router, prefix="/api")

logger.info("Starting app in %s mode", settings.app_env)
