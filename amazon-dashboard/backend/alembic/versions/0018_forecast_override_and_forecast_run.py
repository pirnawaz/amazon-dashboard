"""Sprint 15: Forecast overrides and forecast run metadata.

Revision ID: 0018
Revises: 0017
Create Date: 2026-02-03

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A) forecast_override: owner-controlled manual overrides (absolute or multiplier)
    op.create_table(
        "forecast_override",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("sku", sa.String(length=255), nullable=True),
        sa.Column("marketplace_code", sa.String(length=20), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("override_type", sa.String(length=32), nullable=False),
        sa.Column("value", sa.Numeric(14, 4), nullable=False),
        sa.Column("reason", sa.String(length=512), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_by_email", sa.String(length=320), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint("override_type IN ('absolute', 'multiplier')", name="ck_forecast_override_type"),
        sa.CheckConstraint("start_date <= end_date", name="ck_forecast_override_dates"),
    )
    op.create_index("ix_forecast_override_id", "forecast_override", ["id"], unique=False)
    op.create_index("ix_forecast_override_sku_marketplace", "forecast_override", ["sku", "marketplace_code"], unique=False)
    op.create_index("ix_forecast_override_dates", "forecast_override", ["start_date", "end_date"], unique=False)

    # B) forecast_run: minimal metadata for runs (optional; for drift storage)
    op.create_table(
        "forecast_run",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("sku", sa.String(length=255), nullable=True),
        sa.Column("marketplace_code", sa.String(length=20), nullable=True),
        sa.Column("model_version", sa.String(length=64), nullable=False),
        sa.Column("data_end_date", sa.Date(), nullable=False),
        sa.Column("horizon_days", sa.Integer(), nullable=False),
        sa.Column("mae_30d", sa.Numeric(14, 4), nullable=True),
        sa.Column("mape_30d", sa.Numeric(14, 4), nullable=True),
        sa.Column("drift_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_forecast_run_id", "forecast_run", ["id"], unique=False)
    op.create_index("ix_forecast_run_sku_marketplace", "forecast_run", ["sku", "marketplace_code"], unique=False)
    op.create_index("ix_forecast_run_data_end_date", "forecast_run", ["data_end_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_forecast_run_data_end_date", table_name="forecast_run")
    op.drop_index("ix_forecast_run_sku_marketplace", table_name="forecast_run")
    op.drop_index("ix_forecast_run_id", table_name="forecast_run")
    op.drop_table("forecast_run")

    op.drop_index("ix_forecast_override_dates", table_name="forecast_override")
    op.drop_index("ix_forecast_override_sku_marketplace", table_name="forecast_override")
    op.drop_index("ix_forecast_override_id", table_name="forecast_override")
    op.drop_constraint("ck_forecast_override_dates", "forecast_override", type_="check")
    op.drop_constraint("ck_forecast_override_type", "forecast_override", type_="check")
    op.drop_table("forecast_override")
