# MF Pulse Engine

Mutual fund intelligence, classification, and simulation platform for Jhaveri Securities Limited.

## Quick Start (Local Dev)

```bash
cp .env.example .env          # Edit with your Morningstar credentials
docker compose up -d           # Starts API + PostgreSQL
# API at http://localhost:8001
# Docs at http://localhost:8001/docs
```

## Production Deployment

```bash
# On EC2 13.206.34.214
docker build -t mf-pulse .
docker run -d --name mf-pulse --restart always \
  -p 8001:8000 --env-file /home/ubuntu/mf-pulse.env mf-pulse
```

## Architecture

See `CLAUDE.md` for full architecture, code standards, and build sequence.

## Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 + PostgreSQL 16
- **Frontend:** Next.js 14 static export served by FastAPI
- **Data:** Morningstar API Center (bulk CSV feeds)
- **Intelligence:** MarketPulse bridge (breadth, sentiment, sector RS)
- **Deployment:** Docker on EC2 (13.206.34.214:8001)
