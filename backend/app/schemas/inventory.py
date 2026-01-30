from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class RestockRow(BaseModel):
    sku: str
    title: str | None
    asin: str | None
    on_hand: int
    avg_daily_units: float
    days_of_cover: float
    reorder_qty: int
    risk_level: Literal["CRITICAL", "LOW", "OK"]


class RestockResponse(BaseModel):
    days: int
    target_days: int
    marketplace: str
    limit: int
    items: list[RestockRow]
