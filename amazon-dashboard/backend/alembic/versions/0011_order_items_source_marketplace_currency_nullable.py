"""Phase 10.4.1: order_items source/source_order_item_id; marketplaces.currency nullable

Revision ID: 0011
Revises: 0010
Create Date: 2026-02-02

- order_items: add source (TEXT nullable), source_order_item_id (TEXT nullable).
  Unique on (source, source_order_item_id) WHERE source_order_item_id IS NOT NULL.
- marketplaces: alter currency to nullable (no USD default for sync-created rows).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("order_items", sa.Column("source", sa.Text(), nullable=True))
    op.add_column("order_items", sa.Column("source_order_item_id", sa.Text(), nullable=True))
    op.execute(
        "CREATE UNIQUE INDEX uq_order_items_source_source_order_item_id "
        "ON order_items (source, source_order_item_id) "
        "WHERE source_order_item_id IS NOT NULL"
    )

    op.alter_column(
        "marketplaces",
        "currency",
        existing_type=sa.String(10),
        nullable=True,
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_order_items_source_source_order_item_id")
    op.drop_column("order_items", "source_order_item_id")
    op.drop_column("order_items", "source")

    op.execute("UPDATE marketplaces SET currency = 'USD' WHERE currency IS NULL")
    op.alter_column(
        "marketplaces",
        "currency",
        existing_type=sa.String(10),
        nullable=False,
    )
