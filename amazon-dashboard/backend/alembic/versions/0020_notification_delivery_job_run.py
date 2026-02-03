"""Sprint 17: Notification delivery log and background job run log.

Revision ID: 0020
Revises: 0019
Create Date: 2026-02-03

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A) notification_delivery
    op.create_table(
        "notification_delivery",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("notification_type", sa.String(length=128), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("recipient", sa.String(length=512), nullable=False),
        sa.Column("subject", sa.String(length=512), nullable=True),
        sa.Column("payload", JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notification_delivery_id", "notification_delivery", ["id"], unique=False)
    op.create_index(
        "ix_notification_delivery_type_severity",
        "notification_delivery",
        ["notification_type", "severity"],
        unique=False,
    )
    op.create_index("ix_notification_delivery_status", "notification_delivery", ["status"], unique=False)
    op.create_index("ix_notification_delivery_created_at", "notification_delivery", ["created_at"], unique=False)

    # B) job_run
    op.create_table(
        "job_run",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("job_name", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("metadata", JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_job_run_id", "job_run", ["id"], unique=False)
    op.create_index("ix_job_run_job_name_started_at", "job_run", ["job_name", "started_at"], unique=False)
    op.create_index("ix_job_run_status", "job_run", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_job_run_status", table_name="job_run")
    op.drop_index("ix_job_run_job_name_started_at", table_name="job_run")
    op.drop_index("ix_job_run_id", table_name="job_run")
    op.drop_table("job_run")

    op.drop_index("ix_notification_delivery_created_at", table_name="notification_delivery")
    op.drop_index("ix_notification_delivery_status", table_name="notification_delivery")
    op.drop_index("ix_notification_delivery_type_severity", table_name="notification_delivery")
    op.drop_index("ix_notification_delivery_id", table_name="notification_delivery")
    op.drop_table("notification_delivery")
