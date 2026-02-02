"""
Amazon Selling Partner API (SP-API) integration.

Uses LWA for access tokens and AWS SigV4 for request signing.
"""

from app.integrations.amazon_spapi.client import SpApiClient, SpApiClientError
from app.integrations.amazon_spapi.config import SpApiConfig, get_sp_api_config

__all__ = ["SpApiClient", "SpApiClientError", "SpApiConfig", "get_sp_api_config"]
