"""Phase 10.1c: amazon_connection last_check_at, last_check_ok, last_check_error

Revision ID: 0007
Revises: 0006
Create Date: 2026-02-02

Adds SP-API ping result fields to amazon_connection.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "amazon_connection",
        sa.Column("last_check_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "amazon_connection",
        sa.Column("last_check_ok", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "amazon_connection",
        sa.Column("last_check_error", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("amazon_connection", "last_check_error")
    op.drop_column("amazon_connection", "last_check_ok")
    op.drop_column("amazon_connection", "last_check_at")
