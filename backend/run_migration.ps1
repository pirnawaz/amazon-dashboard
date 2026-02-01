# Run Phase 8 migration. Requires DATABASE_URL (and JWT_SECRET, APP_ENV) in .env at amazon-dashboard/.env
Set-Location $PSScriptRoot

# Use venv if present
if (Test-Path ".\venv\Scripts\Activate.ps1") {
    .\venv\Scripts\Activate.ps1
} elseif (Test-Path "\.venv\Scripts\Activate.ps1") {
    .\.venv\Scripts\Activate.ps1
}

# Ensure alembic is available
if (-not (Get-Command alembic -ErrorAction SilentlyContinue)) {
    pip install -r requirements.txt
}

alembic upgrade head
