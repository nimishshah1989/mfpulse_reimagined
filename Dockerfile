# ============================================================================
# MF Pulse Engine — Multi-stage Dockerfile
# Stage 1: Build Next.js static frontend
# Stage 2: Python runtime with FastAPI + static files
# ============================================================================

# ── Stage 1: Node.js build ──────────────────────────
FROM node:20-alpine AS frontend

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app/web
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ .
ENV NEXT_PUBLIC_API_URL=""
RUN pnpm run build

# ── Stage 2: Python runtime ─────────────────────────
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc g++ curl && \
    rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app/ ./app/
COPY alembic.ini ./
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/

COPY --from=frontend /app/web/out ./web/out

RUN mkdir -p /app/data_feeds /app/data_cache

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-c", "import os,uvicorn;uvicorn.run('app.main:app',host='0.0.0.0',port=int(os.environ.get('APP_PORT','8000')))"]
