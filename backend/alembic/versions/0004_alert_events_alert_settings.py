"""alert_events + alert_settings (Phase 7B)

Revision ID: 0004
Revises: 0003
Create Date: 2026-02-01

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "alert_events",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("alert_type", sa.String(length=50), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("sku", sa.String(length=100), nullable=True),
        sa.Column("marketplace", sa.String(length=20), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("dedupe_key", sa.String(length=255), nullable=False),
        sa.Column("is_acknowledged", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_alert_events_id", "alert_events", ["id"], unique=False)
    op.create_index("ix_alert_events_alert_type", "alert_events", ["alert_type"], unique=False)
    op.create_index("ix_alert_events_severity", "alert_events", ["severity"], unique=False)
    op.create_index("ix_alert_events_sku", "alert_events", ["sku"], unique=False)
    op.create_index("ix_alert_events_marketplace", "alert_events", ["marketplace"], unique=False)
    op.create_index("ix_alert_events_created_at", "alert_events", ["created_at"], unique=False)
    op.create_unique_constraint("uq_alert_events_dedupe_key", "alert_events", ["dedupe_key"])

    op.create_table(
        "alert_settings",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("email_recipients", sa.Text(), nullable=True),
        sa.Column("send_inventory_stale", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("send_urgent_restock", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("send_reorder_soon", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("send_order_by_passed", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("stale_days_threshold", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_alert_settings_id", "alert_settings", ["id"], unique=False)
    op.execute(
        "INSERT INTO alert_settings (id, email_enabled, send_inventory_stale, send_urgent_restock, send_reorder_soon, send_order_by_passed, stale_days_threshold) "
        "VALUES (1, false, true, true, true, true, 7)"
    )


def downgrade() -> None:
    op.drop_table("alert_settings")
    op.drop_constraint("uq_alert_events_dedupe_key", "alert_events", type_="unique")
    op.drop_index("ix_alert_events_created_at", table_name="alert_events")
    op.drop_index("ix_alert_events_marketplace", table_name="alert_events")
    op.drop_index("ix_alert_events_sku", table_name="alert_events")
    op.drop_index("ix_alert_events_severity", table_name="alert_events")
    op.drop_index("ix_alert_events_alert_type", table_name="alert_events")
    op.drop_index("ix_alert_events_id", table_name="alert_events")
    op.drop_table("alert_events")
