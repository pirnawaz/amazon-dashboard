from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DashboardSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    revenue: Decimal
    units: int
    orders: int
    ad_spend: Decimal
    net_profit_placeholder: Decimal
