"""Sprint 14: Ads attribution daily table and SKU cost (COGS) table.

Revision ID: 0016
Revises: 0015
Create Date: 2026-02-03

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ads_attributed_daily table for daily attributed performance per Ads entity
    op.create_table(
        "ads_attributed_daily",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("profile_id", sa.Integer(), nullable=True),
        sa.Column("marketplace_code", sa.String(length=20), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("campaign_id_external", sa.String(length=255), nullable=True),
        sa.Column("ad_group_id_external", sa.String(length=255), nullable=True),
        sa.Column("entity_type", sa.String(length=50), nullable=True),
        sa.Column("target_id_external", sa.String(length=255), nullable=True),
        sa.Column("asin", sa.String(length=20), nullable=True),
        sa.Column("sku", sa.String(length=255), nullable=True),
        sa.Column("attributed_sales", sa.Numeric(precision=14, scale=2), server_default="0", nullable=False),
        sa.Column("attributed_conversions", sa.Integer(), server_default="0", nullable=False),
        sa.Column("attributed_units", sa.Integer(), server_default="0", nullable=False),
        sa.Column("attributed_orders", sa.Integer(), server_default="0", nullable=False),
        sa.Column("ad_spend", sa.Numeric(precision=14, scale=2), server_default="0", nullable=False),
        sa.Column("impressions", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("clicks", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    # Unique constraint to prevent duplicates
    op.create_unique_constraint(
        "uq_ads_attributed_daily_key",
        "ads_attributed_daily",
        ["profile_id", "date", "campaign_id_external", "ad_group_id_external", "target_id_external", "asin"],
    )
    # Indexes for common queries
    op.create_index("ix_ads_attributed_daily_id", "ads_attributed_daily", ["id"], unique=False)
    op.create_index("ix_ads_attributed_daily_date", "ads_attributed_daily", ["date"], unique=False)
    op.create_index("ix_ads_attributed_daily_sku", "ads_attributed_daily", ["sku"], unique=False)
    op.create_index("ix_ads_attributed_daily_asin", "ads_attributed_daily", ["asin"], unique=False)
    op.create_index("ix_ads_attributed_daily_marketplace_code", "ads_attributed_daily", ["marketplace_code"], unique=False)
    op.create_index("ix_ads_attributed_daily_profile_id", "ads_attributed_daily", ["profile_id"], unique=False)
    op.create_index(
        "ix_ads_attributed_daily_date_marketplace",
        "ads_attributed_daily",
        ["date", "marketplace_code"],
        unique=False,
    )

    # Create sku_cost table for per-SKU COGS
    op.create_table(
        "sku_cost",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("sku", sa.String(length=255), nullable=False),
        sa.Column("marketplace_code", sa.String(length=20), nullable=True),
        sa.Column("unit_cost", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    # Unique constraint on (sku, marketplace_code) - marketplace_code NULL means global
    op.create_unique_constraint(
        "uq_sku_cost_sku_marketplace",
        "sku_cost",
        ["sku", "marketplace_code"],
    )
    op.create_index("ix_sku_cost_id", "sku_cost", ["id"], unique=False)
    op.create_index("ix_sku_cost_sku", "sku_cost", ["sku"], unique=False)
    op.create_index("ix_sku_cost_marketplace_code", "sku_cost", ["marketplace_code"], unique=False)


def downgrade() -> None:
    # Drop sku_cost table
    op.drop_index("ix_sku_cost_marketplace_code", table_name="sku_cost")
    op.drop_index("ix_sku_cost_sku", table_name="sku_cost")
    op.drop_index("ix_sku_cost_id", table_name="sku_cost")
    op.drop_constraint("uq_sku_cost_sku_marketplace", "sku_cost", type_="unique")
    op.drop_table("sku_cost")

    # Drop ads_attributed_daily table
    op.drop_index("ix_ads_attributed_daily_date_marketplace", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_attributed_daily_profile_id", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_attributed_daily_marketplace_code", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_attributed_daily_asin", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_attributed_daily_sku", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_attributed_daily_date", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_attributed_daily_id", table_name="ads_attributed_daily")
    op.drop_constraint("uq_ads_attributed_daily_key", "ads_attributed_daily", type_="unique")
    op.drop_table("ads_attributed_daily")
