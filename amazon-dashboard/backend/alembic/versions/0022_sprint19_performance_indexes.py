"""Sprint 19: Production readiness — performance indexes.

Revision ID: 0022
Revises: 0021
Create Date: 2026-02-03

Adds indexes for hottest query patterns (order_items, ads, inventory, sku_mappings,
forecast_override, restock_recommendation, notification_delivery, job_run).
Constraint/index names kept under 63 chars.
"""
from __future__ import annotations

from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- order_items: date-range and sku filters (dashboard, timeseries, forecast) ---
    op.create_index(
        "ix_order_items_marketplace_id_order_date",
        "order_items",
        ["marketplace_id", "order_date"],
        unique=False,
    )
    op.create_index(
        "ix_order_items_sku_order_date",
        "order_items",
        ["sku", "order_date"],
        unique=False,
    )

    # --- amazon_order_item: lookups by asin (attribution/reports) ---
    op.create_index(
        "ix_amazon_order_item_asin",
        "amazon_order_item",
        ["asin"],
        unique=False,
    )

    # --- ads_daily_metrics: profile + date (already have single-column; add composite) ---
    op.create_index(
        "ix_ads_daily_metrics_profile_date",
        "ads_daily_metrics",
        ["ads_profile_id", "date"],
        unique=False,
    )

    # --- ads_attributed_daily: sku/asin/profile + date ---
    op.create_index(
        "ix_ads_attr_daily_sku_date",
        "ads_attributed_daily",
        ["sku", "date"],
        unique=False,
    )
    op.create_index(
        "ix_ads_attr_daily_asin_date",
        "ads_attributed_daily",
        ["asin", "date"],
        unique=False,
    )
    op.create_index(
        "ix_ads_attr_daily_profile_date",
        "ads_attributed_daily",
        ["ads_profile_id", "date"],
        unique=False,
    )

    # --- inventory_levels: sku+marketplace, updated_at ---
    op.create_index(
        "ix_inventory_levels_sku_marketplace",
        "inventory_levels",
        ["sku", "marketplace"],
        unique=False,
    )
    op.create_index(
        "ix_inventory_levels_updated_at",
        "inventory_levels",
        ["updated_at"],
        unique=False,
    )

    # --- sku_mappings: asin (lookups by asin); sku/marketplace_code may be in unique ---
    op.create_index(
        "ix_sku_mappings_asin",
        "sku_mappings",
        ["asin"],
        unique=False,
    )

    # --- forecast_override: (sku, marketplace_code, start_date), end_date ---
    op.create_index(
        "ix_forecast_override_sku_mp_start",
        "forecast_override",
        ["sku", "marketplace_code", "start_date"],
        unique=False,
    )
    op.create_index(
        "ix_forecast_override_end_date",
        "forecast_override",
        ["end_date"],
        unique=False,
    )

    # --- restock_recommendation: priority_score (sort/filter) ---
    op.create_index(
        "ix_restock_recommendation_priority_score",
        "restock_recommendation",
        ["priority_score"],
        unique=False,
    )

    # --- notification_delivery: (status, created_at), (severity, created_at) ---
    op.create_index(
        "ix_notif_delivery_status_created_at",
        "notification_delivery",
        ["status", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_notif_delivery_severity_created_at",
        "notification_delivery",
        ["severity", "created_at"],
        unique=False,
    )

    # --- job_run: (status, started_at) for filtering by status + time ---
    op.create_index(
        "ix_job_run_status_started_at",
        "job_run",
        ["status", "started_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_job_run_status_started_at", table_name="job_run")
    op.drop_index("ix_notif_delivery_severity_created_at", table_name="notification_delivery")
    op.drop_index("ix_notif_delivery_status_created_at", table_name="notification_delivery")
    op.drop_index("ix_restock_recommendation_priority_score", table_name="restock_recommendation")
    op.drop_index("ix_forecast_override_end_date", table_name="forecast_override")
    op.drop_index("ix_forecast_override_sku_mp_start", table_name="forecast_override")
    op.drop_index("ix_sku_mappings_asin", table_name="sku_mappings")
    op.drop_index("ix_inventory_levels_updated_at", table_name="inventory_levels")
    op.drop_index("ix_inventory_levels_sku_marketplace", table_name="inventory_levels")
    op.drop_index("ix_ads_attr_daily_profile_date", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_attr_daily_asin_date", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_attr_daily_sku_date", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_daily_metrics_profile_date", table_name="ads_daily_metrics")
    op.drop_index("ix_amazon_order_item_asin", table_name="amazon_order_item")
    op.drop_index("ix_order_items_sku_order_date", table_name="order_items")
    op.drop_index("ix_order_items_marketplace_id_order_date", table_name="order_items")
