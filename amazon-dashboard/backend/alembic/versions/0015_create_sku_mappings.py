"""Phase 12.1: sku_mappings table for catalog mapping (SKU + marketplace -> product, status).

Revision ID: 0015
Revises: 0014
Create Date: 2026-02-02

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sku_mappings",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("sku", sa.String(length=255), nullable=False),
        sa.Column("marketplace_code", sa.String(length=20), nullable=False),
        sa.Column("asin", sa.String(length=20), nullable=True),
        sa.Column("fnsku", sa.String(length=255), nullable=True),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_sku_mappings_id", "sku_mappings", ["id"], unique=False)
    op.create_unique_constraint(
        "uq_sku_mappings_sku_marketplace_code",
        "sku_mappings",
        ["sku", "marketplace_code"],
    )
    op.create_index("ix_sku_mappings_product_id", "sku_mappings", ["product_id"], unique=False)
    op.create_index("ix_sku_mappings_status", "sku_mappings", ["status"], unique=False)
    op.create_index(
        "ix_sku_mappings_marketplace_code_status",
        "sku_mappings",
        ["marketplace_code", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_sku_mappings_marketplace_code_status", table_name="sku_mappings")
    op.drop_index("ix_sku_mappings_status", table_name="sku_mappings")
    op.drop_index("ix_sku_mappings_product_id", table_name="sku_mappings")
    op.drop_constraint("uq_sku_mappings_sku_marketplace_code", "sku_mappings", type_="unique")
    op.drop_index("ix_sku_mappings_id", table_name="sku_mappings")
    op.drop_table("sku_mappings")
