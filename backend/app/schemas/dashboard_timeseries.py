from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class DashboardTimeseriesPoint(BaseModel):
    date: date
    revenue: float
    units: int
    orders: int
    ad_spend: float
    net_profit_placeholder: float


class DashboardTimeseriesResponse(BaseModel):
    days: int
    marketplace: str
    points: list[DashboardTimeseriesPoint]


class TopProductRow(BaseModel):
    sku: str
    title: str | None
    asin: str | None
    revenue: float
    units: int
    orders: int


class TopProductsResponse(BaseModel):
    days: int
    marketplace: str
    limit: int
    products: list[TopProductRow]
