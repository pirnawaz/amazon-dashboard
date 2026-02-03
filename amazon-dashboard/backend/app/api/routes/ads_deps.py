"""Dependencies for ads routes: owner-only for connect/sync."""
from __future__ import annotations

from app.api.deps.permissions import require_owner

# Owner-only for connecting ads account and triggering sync
require_owner_for_connect = require_owner
