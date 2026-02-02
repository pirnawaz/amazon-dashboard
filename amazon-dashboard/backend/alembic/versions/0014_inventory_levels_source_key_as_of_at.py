"""Phase 11.3: inventory_levels source_key, as_of_at, UNIQUE(source, source_key).

Path A — Internal inventory model (inventory_levels) exists. We extend it so the
SP-API bridge can upsert by (source='spapi', source_key) without duplicating rows.
- Add source_key (nullable at first for backfill), as_of_at (nullable).
- Backfill existing rows: source_key = 'manual_' || sku || '_' || marketplace.
- Add UNIQUE(source, source_key), drop UNIQUE(sku, marketplace).
get_inventory(sku, marketplace) will prefer spapi row or latest as_of_at (see inventory_service).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inventory_levels",
        sa.Column("source_key", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "inventory_levels",
        sa.Column("as_of_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Backfill: existing rows get source_key so UNIQUE(source, source_key) can apply
    op.execute(
        sa.text(
            "UPDATE inventory_levels SET source_key = 'manual_' || sku || '_' || marketplace "
            "WHERE source_key IS NULL"
        )
    )
    op.alter_column(
        "inventory_levels",
        "source_key",
        existing_type=sa.String(length=255),
        nullable=False,
    )
    op.create_unique_constraint(
        "uq_inventory_levels_source_source_key",
        "inventory_levels",
        ["source", "source_key"],
    )
    op.drop_constraint("uq_inventory_levels_sku_marketplace", "inventory_levels", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint(
        "uq_inventory_levels_sku_marketplace",
        "inventory_levels",
        ["sku", "marketplace"],
    )
    op.drop_constraint("uq_inventory_levels_source_source_key", "inventory_levels", type_="unique")
    op.drop_column("inventory_levels", "as_of_at")
    op.drop_column("inventory_levels", "source_key")
