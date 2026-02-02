"""Phase 10.2: amazon_connection last_orders_sync_at, last_orders_sync_status, last_orders_sync_error

Revision ID: 0008
Revises: 0007
Create Date: 2026-02-02

Adds orders sync tracking fields to amazon_connection.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "amazon_connection",
        sa.Column("last_orders_sync_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "amazon_connection",
        sa.Column("last_orders_sync_status", sa.Text(), nullable=True),
    )
    op.add_column(
        "amazon_connection",
        sa.Column("last_orders_sync_error", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("amazon_connection", "last_orders_sync_error")
    op.drop_column("amazon_connection", "last_orders_sync_status")
    op.drop_column("amazon_connection", "last_orders_sync_at")
