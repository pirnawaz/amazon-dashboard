"""Sprint 13: Amazon Ads API – ads_account, ads_profile, campaigns, ad_groups, targets/keywords, daily_metrics.

Revision ID: 0016
Revises: 0015
Create Date: 2026-02-02

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ads_account",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_status", sa.String(length=50), nullable=True),
        sa.Column("last_sync_error", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ads_account_id", "ads_account", ["id"], unique=False)
    op.create_index("ix_ads_account_status", "ads_account", ["status"], unique=False)

    op.create_table(
        "ads_profile",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("ads_account_id", sa.Integer(), nullable=False),
        sa.Column("profile_id", sa.String(length=64), nullable=False),
        sa.Column("marketplace_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("profile_type", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["ads_account_id"], ["ads_account.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["marketplace_id"], ["marketplaces.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_ads_profile_id", "ads_profile", ["id"], unique=False)
    op.create_index("ix_ads_profile_ads_account_id", "ads_profile", ["ads_account_id"], unique=False)
    op.create_index("ix_ads_profile_profile_id", "ads_profile", ["profile_id"], unique=True)

    op.create_table(
        "ads_campaign",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("ads_profile_id", sa.Integer(), nullable=False),
        sa.Column("campaign_id_external", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("state", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["ads_profile_id"], ["ads_profile.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_ads_campaign_id", "ads_campaign", ["id"], unique=False)
    op.create_index("ix_ads_campaign_ads_profile_id", "ads_campaign", ["ads_profile_id"], unique=False)
    op.create_unique_constraint(
        "uq_ads_campaign_profile_external",
        "ads_campaign",
        ["ads_profile_id", "campaign_id_external"],
    )

    op.create_table(
        "ads_ad_group",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("ads_campaign_id", sa.Integer(), nullable=False),
        sa.Column("ad_group_id_external", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("state", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["ads_campaign_id"], ["ads_campaign.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_ads_ad_group_id", "ads_ad_group", ["id"], unique=False)
    op.create_index("ix_ads_ad_group_ads_campaign_id", "ads_ad_group", ["ads_campaign_id"], unique=False)
    op.create_unique_constraint(
        "uq_ads_ad_group_campaign_external",
        "ads_ad_group",
        ["ads_campaign_id", "ad_group_id_external"],
    )

    op.create_table(
        "ads_target_keyword",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("ads_ad_group_id", sa.Integer(), nullable=False),
        sa.Column("target_id_external", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False, server_default="keyword"),
        sa.Column("text", sa.String(length=512), nullable=True),
        sa.Column("state", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["ads_ad_group_id"], ["ads_ad_group.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_ads_target_keyword_id", "ads_target_keyword", ["id"], unique=False)
    op.create_index("ix_ads_target_keyword_ads_ad_group_id", "ads_target_keyword", ["ads_ad_group_id"], unique=False)
    op.create_unique_constraint(
        "uq_ads_target_keyword_ad_group_external",
        "ads_target_keyword",
        ["ads_ad_group_id", "target_id_external"],
    )

    op.create_table(
        "ads_daily_metrics",
        sa.Column("id", sa.Integer(), sa.Identity(always=False, start=1), nullable=False),
        sa.Column("ads_profile_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("spend", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("sales", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("impressions", sa.BigInteger(), nullable=True),
        sa.Column("clicks", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["ads_profile_id"], ["ads_profile.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_ads_daily_metrics_id", "ads_daily_metrics", ["id"], unique=False)
    op.create_index("ix_ads_daily_metrics_ads_profile_id", "ads_daily_metrics", ["ads_profile_id"], unique=False)
    op.create_index("ix_ads_daily_metrics_date", "ads_daily_metrics", ["date"], unique=False)
    op.create_unique_constraint(
        "uq_ads_daily_metrics_profile_date",
        "ads_daily_metrics",
        ["ads_profile_id", "date"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_ads_daily_metrics_profile_date", "ads_daily_metrics", type_="unique")
    op.drop_index("ix_ads_daily_metrics_date", table_name="ads_daily_metrics")
    op.drop_index("ix_ads_daily_metrics_ads_profile_id", table_name="ads_daily_metrics")
    op.drop_index("ix_ads_daily_metrics_id", table_name="ads_daily_metrics")
    op.drop_table("ads_daily_metrics")

    op.drop_constraint("uq_ads_target_keyword_ad_group_external", "ads_target_keyword", type_="unique")
    op.drop_index("ix_ads_target_keyword_ads_ad_group_id", table_name="ads_target_keyword")
    op.drop_index("ix_ads_target_keyword_id", table_name="ads_target_keyword")
    op.drop_table("ads_target_keyword")

    op.drop_constraint("uq_ads_ad_group_campaign_external", "ads_ad_group", type_="unique")
    op.drop_index("ix_ads_ad_group_ads_campaign_id", table_name="ads_ad_group")
    op.drop_index("ix_ads_ad_group_id", table_name="ads_ad_group")
    op.drop_table("ads_ad_group")

    op.drop_constraint("uq_ads_campaign_profile_external", "ads_campaign", type_="unique")
    op.drop_index("ix_ads_campaign_ads_profile_id", table_name="ads_campaign")
    op.drop_index("ix_ads_campaign_id", table_name="ads_campaign")
    op.drop_table("ads_campaign")

    op.drop_index("ix_ads_profile_profile_id", table_name="ads_profile")
    op.drop_index("ix_ads_profile_ads_account_id", table_name="ads_profile")
    op.drop_index("ix_ads_profile_id", table_name="ads_profile")
    op.drop_table("ads_profile")

    op.drop_index("ix_ads_account_status", table_name="ads_account")
    op.drop_index("ix_ads_account_id", table_name="ads_account")
    op.drop_table("ads_account")
