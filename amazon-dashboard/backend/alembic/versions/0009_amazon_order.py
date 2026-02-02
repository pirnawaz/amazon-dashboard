"""Phase 10.3: amazon_order table for SP-API orders sync

Revision ID: 0009
Revises: 0008
Create Date: 2026-02-02

Creates amazon_order with unique (amazon_order_id, marketplace_id).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "amazon_order",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("amazon_order_id", sa.Text(), nullable=False),
        sa.Column("marketplace_id", sa.Text(), nullable=False),
        sa.Column("purchase_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_update_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("order_status", sa.Text(), nullable=True),
        sa.Column("order_total_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("order_total_currency", sa.Text(), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("amazon_order_id", "marketplace_id", name="uq_amazon_order_amazon_order_id_marketplace_id"),
    )
    op.create_index("ix_amazon_order_id", "amazon_order", ["id"], unique=False)
    op.create_index("ix_amazon_order_amazon_order_id", "amazon_order", ["amazon_order_id"], unique=False)
    op.create_index("ix_amazon_order_marketplace_id", "amazon_order", ["marketplace_id"], unique=False)
    op.create_index("ix_amazon_order_last_update_date", "amazon_order", ["last_update_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_amazon_order_last_update_date", table_name="amazon_order")
    op.drop_index("ix_amazon_order_marketplace_id", table_name="amazon_order")
    op.drop_index("ix_amazon_order_amazon_order_id", table_name="amazon_order")
    op.drop_index("ix_amazon_order_id", table_name="amazon_order")
    op.drop_table("amazon_order")
