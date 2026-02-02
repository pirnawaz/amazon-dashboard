"""
CLI healthcheck: connect to DB (SELECT 1). Exit 0 if ok, 1 otherwise.
Usage: python -m app.scripts.healthcheck
"""
from __future__ import annotations

import sys

from sqlalchemy import text

from app.db.session import engine


def main() -> int:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return 0
    except Exception:
        return 1


if __name__ == "__main__":
    sys.exit(main())
