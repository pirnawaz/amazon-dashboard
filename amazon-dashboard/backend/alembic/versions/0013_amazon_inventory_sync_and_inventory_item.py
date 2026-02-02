"""Phase 11.1: amazon_connection inventory sync fields + amazon_inventory_item table.

Adds last_inventory_sync_* to amazon_connection and creates amazon_inventory_item
for FBA inventory (stub in Phase 11.1).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "amazon_connection",
        sa.Column("last_inventory_sync_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "amazon_connection",
        sa.Column(
            "last_inventory_sync_status",
            sa.Text(),
            nullable=True,
            server_default=sa.text("'never'"),
        ),
    )
    op.add_column(
        "amazon_connection",
        sa.Column("last_inventory_sync_error", sa.Text(), nullable=True),
    )
    op.add_column(
        "amazon_connection",
        sa.Column("last_inventory_sync_items_count", sa.Integer(), nullable=True),
    )

    op.create_table(
        "amazon_inventory_item",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("marketplace_id", sa.Text(), nullable=False),
        sa.Column("seller_sku", sa.Text(), nullable=False),
        sa.Column("fn_sku", sa.Text(), nullable=True),
        sa.Column("asin", sa.Text(), nullable=True),
        sa.Column("quantity_available", sa.Integer(), nullable=True),
        sa.Column("quantity_reserved", sa.Integer(), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "marketplace_id",
            "seller_sku",
            name="uq_amazon_inventory_item_marketplace_id_seller_sku",
        ),
    )
    op.create_index("ix_amazon_inventory_item_id", "amazon_inventory_item", ["id"], unique=False)
    op.create_index("ix_amazon_inventory_item_marketplace_id", "amazon_inventory_item", ["marketplace_id"], unique=False)
    op.create_index("ix_amazon_inventory_item_seller_sku", "amazon_inventory_item", ["seller_sku"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_amazon_inventory_item_seller_sku", table_name="amazon_inventory_item")
    op.drop_index("ix_amazon_inventory_item_marketplace_id", table_name="amazon_inventory_item")
    op.drop_index("ix_amazon_inventory_item_id", table_name="amazon_inventory_item")
    op.drop_table("amazon_inventory_item")

    op.drop_column("amazon_connection", "last_inventory_sync_items_count")
    op.drop_column("amazon_connection", "last_inventory_sync_error")
    op.drop_column("amazon_connection", "last_inventory_sync_status")
    op.drop_column("amazon_connection", "last_inventory_sync_at")
