import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.version import VERSION
from app.core.logging import setup_logging
from app.api.routes.health import router as health_router
from app.api.routes.auth import router as auth_router
from app.api.routes.me import router as me_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.dashboard_analytics import router as dashboard_analytics_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.forecast import router as forecast_router
from app.api.routes.forecast_restock import router as forecast_restock_router
from app.api.routes.restock_actions import router as restock_actions_router
from app.api.routes.admin import router as admin_router
from app.api.routes.admin_amazon_spapi import router as admin_amazon_spapi_router
from app.api.routes.admin_amazon_orders import router as admin_amazon_orders_router
from app.api.routes.admin_amazon_inventory import router as admin_amazon_inventory_router
from app.api.routes.admin_catalog import router as admin_catalog_router
from app.api.routes.admin_data_health import router as admin_data_health_router
from app.api.routes.alerts import router as alerts_router
from app.api.routes.amazon import router as amazon_router
from app.api.restock import router as restock_router
from app.middleware.request_context import RequestContextMiddleware
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.rate_limit import RateLimitMiddleware

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title="Amazon Dashboard API", version=VERSION)


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    request_id = _request_id(request)
    detail = exc.detail
    if isinstance(detail, dict):
        message = detail.get("message", str(detail))
        code = detail.get("code")
    else:
        message = str(detail) if detail else "Request failed"
        code = None
    body: dict = {"error": {"message": message}, "request_id": request_id}
    if code is not None:
        body["error"]["code"] = code
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = _request_id(request)
    errors = exc.errors()
    body = {
        "error": {
            "message": "Validation failed",
            "details": errors,
        },
        "request_id": request_id,
    }
    return JSONResponse(status_code=400, content=body)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = _request_id(request)
    # Log full exception with stack trace (5xx only - we return 500)
    logger.error(
        "Unhandled exception: %s",
        exc,
        exc_info=True,
        extra={
            "request_id": request_id,
            "method": getattr(request, "method", None),
            "path": getattr(request, "url", None) and getattr(request.url, "path", None),
        },
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {"message": "An internal error occurred. Please try again later."},
            "request_id": request_id,
        },
    )


# Middleware order: last added runs first. So: RequestContext -> RequestLogging -> RateLimit -> CORS -> app
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
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RequestContextMiddleware)

app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(me_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(dashboard_analytics_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(forecast_router, prefix="/api")
app.include_router(forecast_restock_router, prefix="/api")
app.include_router(restock_actions_router, prefix="/api/restock")
app.include_router(admin_router, prefix="/api")
app.include_router(admin_amazon_spapi_router, prefix="/api")
app.include_router(admin_amazon_orders_router, prefix="/api")
app.include_router(admin_amazon_inventory_router, prefix="/api")
app.include_router(admin_catalog_router, prefix="/api")
app.include_router(admin_data_health_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(amazon_router, prefix="/api")
app.include_router(restock_router, prefix="/api")

logger.info("Starting app in %s mode", settings.app_env)
