"""Sprint 14: Ads attribution daily + SKU cost (COGS).

Revision ID: 0017
Revises: 0016
Create Date: 2026-02-03

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A) ads_attributed_daily: daily attributed performance per Ads entity and ASIN/SKU
    op.create_table(
        "ads_attributed_daily",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("ads_profile_id", sa.Integer(), nullable=False),
        sa.Column("marketplace_id", sa.String(length=32), nullable=True),
        sa.Column("marketplace_code", sa.String(length=20), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("campaign_id_external", sa.String(length=64), nullable=True),
        sa.Column("ad_group_id_external", sa.String(length=64), nullable=True),
        sa.Column("entity_type", sa.String(length=32), nullable=True),
        sa.Column("target_id_external", sa.String(length=64), nullable=True),
        sa.Column("asin", sa.String(length=32), nullable=True),
        sa.Column("sku", sa.String(length=255), nullable=True),
        sa.Column("attributed_sales", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("attributed_conversions", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("attributed_units", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("attributed_orders", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("ad_spend", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("impressions", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("clicks", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["ads_profile_id"], ["ads_profile.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_ads_attributed_daily_id", "ads_attributed_daily", ["id"], unique=False)
    op.create_index("ix_ads_attributed_daily_ads_profile_id", "ads_attributed_daily", ["ads_profile_id"], unique=False)
    op.create_index("ix_ads_attributed_daily_date", "ads_attributed_daily", ["date"], unique=False)
    op.create_index("ix_ads_attributed_daily_sku", "ads_attributed_daily", ["sku"], unique=False)
    op.create_index("ix_ads_attributed_daily_asin", "ads_attributed_daily", ["asin"], unique=False)
    op.create_index("ix_ads_attributed_daily_marketplace_code", "ads_attributed_daily", ["marketplace_code"], unique=False)
    op.create_unique_constraint(
        "uq_ads_attr_daily_prof_date_camp_ag_tgt_asin",
        "ads_attributed_daily",
        [
            "ads_profile_id",
            "date",
            "campaign_id_external",
            "ad_group_id_external",
            "target_id_external",
            "asin",
        ],
    )

    # B) sku_cost: per-SKU COGS (no existing COGS table found). marketplace_code NULL = global.
    op.create_table(
        "sku_cost",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("sku", sa.String(length=255), nullable=False),
        sa.Column("marketplace_code", sa.String(length=20), nullable=True),
        sa.Column("unit_cost", sa.Numeric(12, 4), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sku_cost_id", "sku_cost", ["id"], unique=False)
    op.create_index("ix_sku_cost_sku", "sku_cost", ["sku"], unique=False)
    op.create_index("ix_sku_cost_marketplace_code", "sku_cost", ["marketplace_code"], unique=False)
    # One row per (sku, marketplace_code); for global (marketplace_code IS NULL) only one per sku
    op.create_index(
        "uq_sku_cost_sku_marketplace",
        "sku_cost",
        ["sku", "marketplace_code"],
        unique=True,
        postgresql_where=sa.text("marketplace_code IS NOT NULL"),
    )
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX uq_sku_cost_sku_global ON sku_cost (sku) WHERE marketplace_code IS NULL"
        )
    )


def downgrade() -> None:
    op.drop_index("uq_sku_cost_sku_global", table_name="sku_cost")
    op.drop_index("uq_sku_cost_sku_marketplace", table_name="sku_cost")
    op.drop_index("ix_sku_cost_marketplace_code", table_name="sku_cost")
    op.drop_index("ix_sku_cost_sku", table_name="sku_cost")
    op.drop_index("ix_sku_cost_id", table_name="sku_cost")
    op.drop_table("sku_cost")

    op.drop_constraint(
        "uq_ads_attr_daily_prof_date_camp_ag_tgt_asin",
        "ads_attributed_daily",
        type_="unique",
    )
    op.drop_index("ix_ads_attributed_daily_marketplace_code", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_attributed_daily_asin", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_attributed_daily_sku", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_attributed_daily_date", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_attributed_daily_ads_profile_id", table_name="ads_attributed_daily")
    op.drop_index("ix_ads_attributed_daily_id", table_name="ads_attributed_daily")
    op.drop_table("ads_attributed_daily")
