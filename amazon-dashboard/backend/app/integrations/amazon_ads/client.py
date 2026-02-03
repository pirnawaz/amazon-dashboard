"""
Amazon Ads API client (Sprint 13).

Authentication: LWA OAuth (refresh token -> access token). Separate from SP-API.
Rate limiting: configurable requests per second; sleep between calls.
Read-only: profiles, campaigns, ad groups, keywords/targets, daily metrics.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# LWA token endpoint (same as LWA for other Amazon APIs)
LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token"

# Amazon Ads API base URLs by region
ADS_API_BASE: dict[str, str] = {
    "NA": "https://advertising-api-test.amazon.com",   # Sandbox; production: advertising-api.amazon.com
    "EU": "https://advertising-api-eu-test.amazon.com",
    "FE": "https://advertising-api-fe-test.amazon.com",
}


@dataclass
class AdsApiConfig:
    """Config for Ads API (client id/secret from env or passed in)."""

    client_id: str
    client_secret: str
    refresh_token: str
    region: str = "NA"
    base_url: str | None = None

    def get_base_url(self) -> str:
        if self.base_url:
            return self.base_url.rstrip("/")
        return ADS_API_BASE.get(self.region, ADS_API_BASE["NA"]).rstrip("/")


class AmazonAdsApiError(Exception):
    """Raised when Ads API call fails with a clear message."""

    def __init__(self, message: str, status_code: int | None = None, response_body: str | None = None):
        self.message = message
        self.status_code = status_code
        self.response_body = response_body
        super().__init__(self.message)


def get_access_token(config: AdsApiConfig) -> str:
    """
    Exchange refresh token for LWA access token.
    Raises AmazonAdsApiError if token exchange fails.
    """
    payload: dict[str, Any] = {
        "grant_type": "refresh_token",
        "refresh_token": config.refresh_token,
        "client_id": config.client_id,
        "client_secret": config.client_secret,
    }
    logger.info(
        "amazon_ads_token_request",
        extra={"grant_type": "refresh_token", "region": config.region},
    )
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                LWA_TOKEN_URL,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
    except httpx.HTTPError as e:
        logger.exception("amazon_ads_token_http_error", extra={"error": str(e)})
        raise AmazonAdsApiError(f"Failed to reach token endpoint: {e!s}") from e

    body = resp.text
    if resp.status_code != 200:
        logger.warning(
            "amazon_ads_token_failed",
            extra={"status_code": resp.status_code, "body_preview": body[:200]},
        )
        raise AmazonAdsApiError(
            f"Token exchange failed: HTTP {resp.status_code}. Check client id, secret, and refresh token.",
            status_code=resp.status_code,
            response_body=body,
        )

    try:
        data = resp.json()
    except Exception as e:
        raise AmazonAdsApiError(f"Invalid token response: {e!s}") from e

    access_token = data.get("access_token")
    if not access_token:
        raise AmazonAdsApiError("Token response missing access_token.")
    return str(access_token)


class RateLimiter:
    """Simple rate limiter: min interval between requests (1/rps seconds)."""

    def __init__(self, requests_per_second: float = 2.0):
        self._interval = 1.0 / max(0.1, requests_per_second)
        self._last_call = 0.0

    def wait(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_call
        if elapsed < self._interval:
            time.sleep(self._interval - elapsed)
        self._last_call = time.monotonic()


def _request(
    method: str,
    url: str,
    access_token: str,
    profile_id: str | None,
    limiter: RateLimiter,
    **kwargs: Any,
) -> dict[str, Any] | list[Any]:
    """Make a rate-limited request to Ads API. Profile required for most endpoints."""
    limiter.wait()
    headers: dict[str, str] = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Amazon-Advertising-API-ClientId": settings.amazon_ads_client_id or "",
    }
    if profile_id:
        headers["Amazon-Advertising-API-Scope"] = profile_id

    logger.debug(
        "amazon_ads_request",
        extra={"method": method, "url": url, "profile_id": profile_id},
    )
    with httpx.Client(timeout=60.0) as client:
        resp = client.request(method, url, headers=headers, **kwargs)

    if resp.status_code != 200:
        logger.warning(
            "amazon_ads_api_error",
            extra={"status_code": resp.status_code, "url": url, "body_preview": resp.text[:300]},
        )
        raise AmazonAdsApiError(
            f"Ads API error: HTTP {resp.status_code}. {resp.text[:200]}",
            status_code=resp.status_code,
            response_body=resp.text,
        )

    return resp.json()


def get_profiles(config: AdsApiConfig, access_token: str, limiter: RateLimiter) -> list[dict[str, Any]]:
    """Fetch all advertiser profiles. No profile_id in header for this call."""
    limiter.wait()
    base = config.get_base_url()
    url = f"{base}/v2/profiles"
    headers: dict[str, str] = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Amazon-Advertising-API-ClientId": config.client_id,
    }
    with httpx.Client(timeout=30.0) as client:
        resp = client.get(url, headers=headers)

    if resp.status_code != 200:
        raise AmazonAdsApiError(
            f"Profiles request failed: HTTP {resp.status_code}. {resp.text[:200]}",
            status_code=resp.status_code,
            response_body=resp.text,
        )

    data = resp.json()
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "profiles" in data:
        return data["profiles"]
    return []


def get_campaigns(
    config: AdsApiConfig,
    access_token: str,
    profile_id: str,
    limiter: RateLimiter,
) -> list[dict[str, Any]]:
    """Fetch campaigns for a profile."""
    base = config.get_base_url()
    url = f"{base}/sp/campaigns"
    result = _request("GET", url, access_token, profile_id, limiter)
    if isinstance(result, list):
        return result
    return result.get("campaigns", result) if isinstance(result, dict) else []


def get_ad_groups(
    config: AdsApiConfig,
    access_token: str,
    profile_id: str,
    campaign_id: str,
    limiter: RateLimiter,
) -> list[dict[str, Any]]:
    """Fetch ad groups for a campaign."""
    base = config.get_base_url()
    url = f"{base}/sp/adGroups"
    params = {"campaignIdFilter": campaign_id}
    result = _request("GET", url, access_token, profile_id, limiter, params=params)
    if isinstance(result, list):
        return result
    return result.get("adGroups", result) if isinstance(result, dict) else []


def get_keywords(
    config: AdsApiConfig,
    access_token: str,
    profile_id: str,
    campaign_id: str,
    limiter: RateLimiter,
) -> list[dict[str, Any]]:
    """Fetch keywords for a campaign."""
    base = config.get_base_url()
    url = f"{base}/sp/keywords"
    params = {"campaignIdFilter": campaign_id}
    result = _request("GET", url, access_token, profile_id, limiter, params=params)
    if isinstance(result, list):
        return result
    return result.get("keywords", result) if isinstance(result, dict) else []


def get_targets(
    config: AdsApiConfig,
    access_token: str,
    profile_id: str,
    campaign_id: str,
    limiter: RateLimiter,
) -> list[dict[str, Any]]:
    """Fetch targets for a campaign."""
    base = config.get_base_url()
    url = f"{base}/sp/targets"
    params = {"campaignIdFilter": campaign_id}
    result = _request("GET", url, access_token, profile_id, limiter, params=params)
    if isinstance(result, list):
        return result
    return result.get("targets", result) if isinstance(result, dict) else []


def get_campaigns_metrics(
    config: AdsApiConfig,
    access_token: str,
    profile_id: str,
    start_date: date,
    end_date: date,
    limiter: RateLimiter,
) -> list[dict[str, Any]]:
    """Fetch campaign-level metrics (spend, sales, etc.) for date range."""
    base = config.get_base_url()
    url = f"{base}/sp/campaigns/report"
    # Request report; Ads API often uses async report generation - for simplicity we use sync metrics endpoint if available
    # Standard pattern: POST /v2/sp/campaigns/report with recordType=campaigns, then get report
    # Simplified: use portfolio/campaign metrics endpoint that returns daily breakdown
    body = {
        "reportDate": end_date.isoformat(),
        "recordType": "campaigns",
        "metrics": "cost,attributedSales14d,impressions,clicks",
    }
    result = _request("POST", url, access_token, profile_id, limiter, json=body)
    if isinstance(result, dict) and "reportId" in result:
        # Async report - would need poll; for sync we return empty and rely on mock/DB
        return []
    if isinstance(result, list):
        return result
    return []


def fetch_profile_metrics_mock(profile_id: str, marketplace_code: str, start: date, end: date) -> list[dict[str, Any]]:
    """Return mock daily metrics when Ads API is not configured or for testing."""
    out: list[dict[str, Any]] = []
    d = start
    while d <= end:
        # Deterministic mock
        seed = hash((profile_id, d.isoformat())) % 1000
        spend = round(50 + (seed % 80), 2)
        sales = round(100 + (seed % 200), 2)
        out.append({
            "date": d.isoformat(),
            "profileId": profile_id,
            "cost": spend,
            "attributedSales14d": sales,
            "impressions": 1000 + (seed % 500),
            "clicks": 10 + (seed % 40),
        })
        d += timedelta(days=1)
    return out
