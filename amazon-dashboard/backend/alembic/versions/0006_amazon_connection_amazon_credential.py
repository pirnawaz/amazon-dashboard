"""Phase 9: amazon_connection + amazon_credential (SP-API connection tracking)

Revision ID: 0006
Revises: 0005
Create Date: 2026-02-01

- Single-tenant: one connection for the whole app; structured for multi-marketplace later.
- amazon_connection: id, created_at, updated_at, status, last_success_at, last_error_at,
  last_error_message, marketplaces_json, seller_identifier; indexes on status, updated_at.
- amazon_credential: id, created_at, updated_at, connection_id FK, lwa_refresh_token_encrypted, note;
  index on updated_at.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE connection_status AS ENUM ('pending', 'active', 'error', 'disconnected')")

    op.create_table(
        "amazon_connection",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM("pending", "active", "error", "disconnected", name="connection_status", create_type=False),
            nullable=False,
            server_default=sa.text("'pending'::connection_status"),
        ),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error_message", sa.Text(), nullable=True),
        sa.Column("marketplaces_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("seller_identifier", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_amazon_connection_id", "amazon_connection", ["id"], unique=False)
    op.create_index("ix_amazon_connection_seller_identifier", "amazon_connection", ["seller_identifier"], unique=False)
    op.create_index("ix_amazon_connection_status", "amazon_connection", ["status"], unique=False)
    op.create_index("ix_amazon_connection_updated_at", "amazon_connection", ["updated_at"], unique=False)

    op.create_table(
        "amazon_credential",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("connection_id", sa.Integer(), nullable=False),
        sa.Column("lwa_refresh_token_encrypted", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["connection_id"], ["amazon_connection.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_amazon_credential_id", "amazon_credential", ["id"], unique=False)
    op.create_index("ix_amazon_credential_connection_id", "amazon_credential", ["connection_id"], unique=False)
    op.create_index("ix_amazon_credential_updated_at", "amazon_credential", ["updated_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_amazon_credential_updated_at", table_name="amazon_credential")
    op.drop_index("ix_amazon_credential_connection_id", table_name="amazon_credential")
    op.drop_index("ix_amazon_credential_id", table_name="amazon_credential")
    op.drop_table("amazon_credential")

    op.drop_index("ix_amazon_connection_updated_at", table_name="amazon_connection")
    op.drop_index("ix_amazon_connection_status", table_name="amazon_connection")
    op.drop_index("ix_amazon_connection_seller_identifier", table_name="amazon_connection")
    op.drop_index("ix_amazon_connection_id", table_name="amazon_connection")
    op.drop_table("amazon_connection")

    op.execute("DROP TYPE connection_status")
