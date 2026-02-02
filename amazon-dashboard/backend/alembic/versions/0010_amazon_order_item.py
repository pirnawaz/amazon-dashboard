"""Phase 10.4: amazon_order_item table for SP-API order items

Revision ID: 0010
Revises: 0009
Create Date: 2026-02-02

Creates amazon_order_item with unique (order_item_id, amazon_order_id, marketplace_id).
Constraint name kept under 63 chars for PostgreSQL.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "amazon_order_item",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("order_item_id", sa.Text(), nullable=False),
        sa.Column("amazon_order_id", sa.Text(), nullable=False),
        sa.Column("marketplace_id", sa.Text(), nullable=False),
        sa.Column("seller_sku", sa.Text(), nullable=True),
        sa.Column("asin", sa.Text(), nullable=True),
        sa.Column("quantity_ordered", sa.Integer(), nullable=True),
        sa.Column("item_price_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("item_price_currency", sa.Text(), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "order_item_id",
            "amazon_order_id",
            "marketplace_id",
            name="uq_aoi_order_item_amazon_order_mkt",
        ),
    )
    op.create_index("ix_amazon_order_item_id", "amazon_order_item", ["id"], unique=False)
    op.create_index("ix_amazon_order_item_order_item_id", "amazon_order_item", ["order_item_id"], unique=False)
    op.create_index("ix_amazon_order_item_amazon_order_id", "amazon_order_item", ["amazon_order_id"], unique=False)
    op.create_index("ix_amazon_order_item_marketplace_id", "amazon_order_item", ["marketplace_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_amazon_order_item_marketplace_id", table_name="amazon_order_item")
    op.drop_index("ix_amazon_order_item_amazon_order_id", table_name="amazon_order_item")
    op.drop_index("ix_amazon_order_item_order_item_id", table_name="amazon_order_item")
    op.drop_index("ix_amazon_order_item_id", table_name="amazon_order_item")
    op.drop_table("amazon_order_item")
