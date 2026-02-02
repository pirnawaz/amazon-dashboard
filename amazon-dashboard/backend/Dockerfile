FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Non-root: create user and own /app
RUN useradd -r -s /usr/sbin/nologin appuser && chown -R appuser:appuser /app
USER appuser

RUN chmod +x /app/docker-entrypoint.sh 2>/dev/null || true
ENTRYPOINT ["/bin/sh", "-c"]
# Single CMD string so the whole script is passed to sh -c (multi-line JSON array can cause parse errors)
CMD ["until python -c \"import urllib.request; urllib.request.urlopen('http://db:5432')\" 2>/dev/null || true; do sleep 2; done; alembic upgrade head; python -m app.scripts.seed_mock_data --days 120 2>/dev/null || true; exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')" || exit 1
