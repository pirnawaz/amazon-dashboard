"""Sprint 16: Supplier, SKU supplier settings, restock recommendation snapshot.

Revision ID: 0019
Revises: 0018
Create Date: 2026-02-03

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A) supplier table
    op.create_table(
        "supplier",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("contact_email", sa.String(length=320), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_supplier_id", "supplier", ["id"], unique=False)
    op.create_index("ix_supplier_name", "supplier", ["name"], unique=True)

    # B) sku_supplier_setting (per marketplace optional)
    op.create_table(
        "sku_supplier_setting",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("sku", sa.String(length=255), nullable=False),
        sa.Column("marketplace_code", sa.String(length=20), nullable=True),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column("lead_time_days_mean", sa.Integer(), nullable=False),
        sa.Column("lead_time_days_std", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("moq_units", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("pack_size_units", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("reorder_policy", sa.String(length=32), nullable=False, server_default=sa.text("'min_max'")),
        sa.Column("min_days_of_cover", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("max_days_of_cover", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("service_level", sa.Numeric(5, 4), nullable=False, server_default=sa.text("0.95")),
        sa.Column("holding_cost_rate", sa.Numeric(14, 6), nullable=True),
        sa.Column("stockout_cost_per_unit", sa.Numeric(14, 4), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["supplier_id"], ["supplier.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_sku_supplier_setting_id", "sku_supplier_setting", ["id"], unique=False)
    op.create_index(
        "ix_sku_supplier_setting_sku_mp_supplier",
        "sku_supplier_setting",
        ["sku", "marketplace_code", "supplier_id"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_sku_supplier_setting_sku_mp",
        "sku_supplier_setting",
        ["sku", "marketplace_code"],
    )

    # C) restock_recommendation snapshot
    op.create_table(
        "restock_recommendation",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("sku", sa.String(length=255), nullable=False),
        sa.Column("marketplace_code", sa.String(length=20), nullable=False),
        sa.Column("supplier_id", sa.Integer(), nullable=True),
        sa.Column("on_hand_units", sa.Numeric(14, 4), nullable=False),
        sa.Column("inbound_units", sa.Numeric(14, 4), nullable=False),
        sa.Column("reserved_units", sa.Numeric(14, 4), nullable=False),
        sa.Column("available_units", sa.Numeric(14, 4), nullable=False),
        sa.Column("daily_demand_forecast", sa.Numeric(14, 4), nullable=False),
        sa.Column("lead_time_days_mean", sa.Integer(), nullable=False),
        sa.Column("lead_time_days_std", sa.Integer(), nullable=False),
        sa.Column("safety_stock_units", sa.Numeric(14, 4), nullable=False),
        sa.Column("reorder_point_units", sa.Numeric(14, 4), nullable=False),
        sa.Column("target_stock_units", sa.Numeric(14, 4), nullable=False),
        sa.Column("recommended_order_units", sa.Numeric(14, 4), nullable=False),
        sa.Column("recommended_order_units_rounded", sa.Numeric(14, 4), nullable=False),
        sa.Column("priority_score", sa.Numeric(14, 4), nullable=False),
        sa.Column("reason_flags", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_by_email", sa.String(length=320), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["supplier_id"], ["supplier.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_restock_recommendation_id", "restock_recommendation", ["id"], unique=False)
    op.create_index("ix_restock_recommendation_generated_at", "restock_recommendation", ["generated_at"], unique=False)
    op.create_index("ix_restock_recommendation_sku", "restock_recommendation", ["sku"], unique=False)
    op.create_index("ix_restock_recommendation_marketplace_code", "restock_recommendation", ["marketplace_code"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_restock_recommendation_marketplace_code", table_name="restock_recommendation")
    op.drop_index("ix_restock_recommendation_sku", table_name="restock_recommendation")
    op.drop_index("ix_restock_recommendation_generated_at", table_name="restock_recommendation")
    op.drop_index("ix_restock_recommendation_id", table_name="restock_recommendation")
    op.drop_table("restock_recommendation")

    op.drop_constraint("uq_sku_supplier_setting_sku_mp", "sku_supplier_setting", type_="unique")
    op.drop_index("ix_sku_supplier_setting_sku_mp_supplier", table_name="sku_supplier_setting")
    op.drop_index("ix_sku_supplier_setting_id", table_name="sku_supplier_setting")
    op.drop_table("sku_supplier_setting")

    op.drop_index("ix_supplier_name", table_name="supplier")
    op.drop_index("ix_supplier_id", table_name="supplier")
    op.drop_table("supplier")
