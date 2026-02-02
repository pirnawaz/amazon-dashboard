"""Phase 8: user_role enum, users.role, audit_log table

Revision ID: 0005
Revises: 0004
Create Date: 2026-02-01

- Add PostgreSQL enum user_role (owner, partner).
- Add non-nullable role column to users with default 'owner' for existing rows.
- Create audit_log table with indexes.
- actor_user_id references users.id (Integer) to match existing schema.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create PostgreSQL enum type user_role (raw SQL runs in same transaction)
    op.execute("CREATE TYPE user_role AS ENUM ('owner', 'partner')")

    # 2. Add role column as nullable first, backfill, then set NOT NULL (production-safe)
    op.add_column(
        "users",
        sa.Column(
            "role",
            postgresql.ENUM("owner", "partner", name="user_role", create_type=False),
            nullable=True,
        ),
    )
    op.execute("UPDATE users SET role = 'owner' WHERE role IS NULL")
    op.alter_column(
        "users",
        "role",
        existing_type=postgresql.ENUM("owner", "partner", name="user_role", create_type=False),
        nullable=False,
    )
    op.alter_column(
        "users",
        "role",
        existing_type=postgresql.ENUM("owner", "partner", name="user_role", create_type=False),
        server_default=sa.text("'owner'::user_role"),
    )

    # 3. Create audit_log table
    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("resource_type", sa.Text(), nullable=False),
        sa.Column("resource_id", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_audit_log_created_at_desc",
        "audit_log",
        ["created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC"},
    )
    op.create_index(
        "ix_audit_log_actor_user_id_created_at_desc",
        "audit_log",
        ["actor_user_id", "created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC"},
    )


def downgrade() -> None:
    op.drop_index("ix_audit_log_actor_user_id_created_at_desc", table_name="audit_log")
    op.drop_index("ix_audit_log_created_at_desc", table_name="audit_log")
    op.drop_table("audit_log")

    op.alter_column(
        "users",
        "role",
        existing_type=postgresql.ENUM("owner", "partner", name="user_role", create_type=False),
        server_default=None,
    )
    op.drop_column("users", "role")

    op.execute("DROP TYPE user_role")
