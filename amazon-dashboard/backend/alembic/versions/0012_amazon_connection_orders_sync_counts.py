"""Phase 10.5: amazon_connection last_orders_sync_orders_count, last_orders_sync_items_count

Revision ID: 0012
Revises: 0011
Create Date: 2026-02-02

Adds optional stats fields for orders sync visibility.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "amazon_connection",
        sa.Column("last_orders_sync_orders_count", sa.Integer(), nullable=True),
    )
    op.add_column(
        "amazon_connection",
        sa.Column("last_orders_sync_items_count", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("amazon_connection", "last_orders_sync_items_count")
    op.drop_column("amazon_connection", "last_orders_sync_orders_count")
