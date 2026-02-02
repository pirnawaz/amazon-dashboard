# Run Alembic migrations inside the backend container (DB in Docker, not Laragon).
# Run from amazon-dashboard directory: .\run_migration_docker.ps1
Set-Location $PSScriptRoot
docker compose run --rm backend python -m alembic upgrade head
