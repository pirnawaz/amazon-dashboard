from __future__ import annotations

from sqlalchemy import text

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.version import VERSION
from app.db.session import engine

router = APIRouter()


@router.get("/version")
def get_version():
    """Return app version for debugging. Matches package.json / config/version.ts."""
    return {"version": VERSION}


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/ready")
def ready():
    """Check DB connectivity (SELECT 1). Returns ok or fail."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        return JSONResponse(content={"status": "fail"}, status_code=503)
