"""inventory_levels table (Phase 6)

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-01

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inventory_levels",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("sku", sa.String(length=100), nullable=False),
        sa.Column("marketplace", sa.String(length=20), nullable=False),
        sa.Column("on_hand_units", sa.Numeric(14, 2), nullable=False),
        sa.Column("reserved_units", sa.Numeric(14, 2), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="manual"),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_inventory_levels_id", "inventory_levels", ["id"], unique=False)
    op.create_index("ix_inventory_levels_sku", "inventory_levels", ["sku"], unique=False)
    op.create_index("ix_inventory_levels_marketplace", "inventory_levels", ["marketplace"], unique=False)
    op.create_unique_constraint(
        "uq_inventory_levels_sku_marketplace",
        "inventory_levels",
        ["sku", "marketplace"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_inventory_levels_sku_marketplace", "inventory_levels", type_="unique")
    op.drop_index("ix_inventory_levels_marketplace", table_name="inventory_levels")
    op.drop_index("ix_inventory_levels_sku", table_name="inventory_levels")
    op.drop_index("ix_inventory_levels_id", table_name="inventory_levels")
    op.drop_table("inventory_levels")
