"""mock amazon tables (marketplaces, products, order_items, ad_spend_daily, inventory_snapshots)

Revision ID: 0002
Revises: 0001
Create Date: 2026-01-30

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "marketplaces",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_marketplaces_id", "marketplaces", ["id"], unique=False)
    op.create_index("ix_marketplaces_code", "marketplaces", ["code"], unique=True)

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("sku", sa.String(length=100), nullable=False),
        sa.Column("asin", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_products_id", "products", ["id"], unique=False)
    op.create_index("ix_products_sku", "products", ["sku"], unique=True)

    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("order_id", sa.String(length=100), nullable=False),
        sa.Column("order_date", sa.Date(), nullable=False),
        sa.Column("marketplace_id", sa.Integer(), nullable=False),
        sa.Column("sku", sa.String(length=100), nullable=False),
        sa.Column("units", sa.Integer(), nullable=False),
        sa.Column("revenue", sa.Numeric(12, 2), nullable=False),
        sa.ForeignKeyConstraint(["marketplace_id"], ["marketplaces.id"]),
        sa.ForeignKeyConstraint(["sku"], ["products.sku"]),
    )
    op.create_index("ix_order_items_id", "order_items", ["id"], unique=False)
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"], unique=False)
    op.create_index("ix_order_items_order_date", "order_items", ["order_date"], unique=False)

    op.create_table(
        "ad_spend_daily",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("marketplace_id", sa.Integer(), nullable=False),
        sa.Column("spend", sa.Numeric(12, 2), nullable=False),
        sa.ForeignKeyConstraint(["marketplace_id"], ["marketplaces.id"]),
    )
    op.create_index("ix_ad_spend_daily_id", "ad_spend_daily", ["id"], unique=False)
    op.create_index("ix_ad_spend_daily_date", "ad_spend_daily", ["date"], unique=False)

    op.create_table(
        "inventory_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("sku", sa.String(length=100), nullable=False),
        sa.Column("on_hand", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["sku"], ["products.sku"]),
    )
    op.create_index("ix_inventory_snapshots_id", "inventory_snapshots", ["id"], unique=False)
    op.create_index("ix_inventory_snapshots_date", "inventory_snapshots", ["date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_inventory_snapshots_date", table_name="inventory_snapshots")
    op.drop_index("ix_inventory_snapshots_id", table_name="inventory_snapshots")
    op.drop_table("inventory_snapshots")

    op.drop_index("ix_ad_spend_daily_date", table_name="ad_spend_daily")
    op.drop_index("ix_ad_spend_daily_id", table_name="ad_spend_daily")
    op.drop_table("ad_spend_daily")

    op.drop_index("ix_order_items_order_date", table_name="order_items")
    op.drop_index("ix_order_items_order_id", table_name="order_items")
    op.drop_index("ix_order_items_id", table_name="order_items")
    op.drop_table("order_items")

    op.drop_index("ix_products_sku", table_name="products")
    op.drop_index("ix_products_id", table_name="products")
    op.drop_table("products")

    op.drop_index("ix_marketplaces_code", table_name="marketplaces")
    op.drop_index("ix_marketplaces_id", table_name="marketplaces")
    op.drop_table("marketplaces")
