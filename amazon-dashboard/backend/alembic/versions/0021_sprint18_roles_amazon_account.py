"""Sprint 18: viewer role, amazon_account table, link integrations.

Revision ID: 0021
Revises: 0020
Create Date: 2026-02-03

- Add 'viewer' to user_role enum.
- Create amazon_account table (id, name, is_active, created_at, updated_at).
- Add amazon_account_id (nullable FK) to amazon_connection and ads_account.
- Insert default account and backfill existing rows.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add 'viewer' to user_role enum (PostgreSQL: ADD VALUE must run outside transaction)
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer'")

    # 2. Create amazon_account table
    op.create_table(
        "amazon_account",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_amazon_account_is_active", "amazon_account", ["is_active"], unique=False)

    # 3. Add amazon_account_id to amazon_connection (nullable)
    op.add_column(
        "amazon_connection",
        sa.Column("amazon_account_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_amazon_connection_amazon_account_id",
        "amazon_connection",
        "amazon_account",
        ["amazon_account_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_amazon_connection_amazon_account_id",
        "amazon_connection",
        ["amazon_account_id"],
        unique=False,
    )

    # 4. Add amazon_account_id to ads_account (nullable)
    op.add_column(
        "ads_account",
        sa.Column("amazon_account_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_ads_account_amazon_account_id",
        "ads_account",
        "amazon_account",
        ["amazon_account_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_ads_account_amazon_account_id",
        "ads_account",
        ["amazon_account_id"],
        unique=False,
    )

    # 5. Insert default account and backfill (idempotent: only if no account exists)
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "INSERT INTO amazon_account (name, is_active, created_at, updated_at) "
            "SELECT 'Default', true, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC' "
            "WHERE NOT EXISTS (SELECT 1 FROM amazon_account LIMIT 1)"
        )
    )
    # Get the default account id (first row)
    result = conn.execute(sa.text("SELECT id FROM amazon_account ORDER BY id LIMIT 1"))
    row = result.fetchone()
    if row:
        default_id = row[0]
        conn.execute(
            sa.text("UPDATE amazon_connection SET amazon_account_id = :aid WHERE amazon_account_id IS NULL"),
            {"aid": default_id},
        )
        conn.execute(
            sa.text("UPDATE ads_account SET amazon_account_id = :aid WHERE amazon_account_id IS NULL"),
            {"aid": default_id},
        )


def downgrade() -> None:
    op.drop_index("ix_ads_account_amazon_account_id", table_name="ads_account")
    op.drop_constraint("fk_ads_account_amazon_account_id", "ads_account", type_="foreignkey")
    op.drop_column("ads_account", "amazon_account_id")

    op.drop_index("ix_amazon_connection_amazon_account_id", table_name="amazon_connection")
    op.drop_constraint("fk_amazon_connection_amazon_account_id", "amazon_connection", type_="foreignkey")
    op.drop_column("amazon_connection", "amazon_account_id")

    op.drop_index("ix_amazon_account_is_active", table_name="amazon_account")
    op.drop_table("amazon_account")

    # Note: PostgreSQL does not support removing an enum value easily. We leave 'viewer' in user_role.