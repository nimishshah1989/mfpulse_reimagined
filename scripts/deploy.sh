#!/bin/bash
# MF Pulse — Lightweight deployment script
# Usage: ./scripts/deploy.sh [backend|frontend|full]
#
# backend  — git pull + restart container (no rebuild, ~10 seconds)
# frontend — rebuild frontend layer only + restart (~1 minute)
# full     — full docker rebuild (~3 minutes, only when Dockerfile/deps change)

set -euo pipefail

MODE="${1:-backend}"
REMOTE="ubuntu@13.206.34.214"
SSH_KEY="~/.ssh/jsl-wealth-key.pem"
PROJECT_DIR="/home/ubuntu/mfpulse_reimagined"
CONTAINER="mf-pulse"

ssh_cmd() {
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$REMOTE" "$1"
}

echo "=== MF Pulse Deploy ($MODE) ==="

case "$MODE" in
    backend)
        echo ">>> Pulling latest code..."
        ssh_cmd "cd $PROJECT_DIR && git pull origin main"

        echo ">>> Syncing backend code into running container..."
        ssh_cmd "docker cp $PROJECT_DIR/backend/app/. $CONTAINER:/app/app/"
        ssh_cmd "docker cp $PROJECT_DIR/scripts/. $CONTAINER:/app/scripts/"

        echo ">>> Restarting container (preserves image, just restarts process)..."
        ssh_cmd "docker restart $CONTAINER"

        echo ">>> Waiting for health check..."
        sleep 5
        ssh_cmd "curl -sf http://localhost:8001/health && echo ' OK' || echo ' FAILED'"
        ;;

    frontend)
        echo ">>> Pulling latest code..."
        ssh_cmd "cd $PROJECT_DIR && git pull origin main"

        echo ">>> Rebuilding (uses Docker layer cache for unchanged layers)..."
        ssh_cmd "cd $PROJECT_DIR && docker compose build"

        echo ">>> Restarting..."
        ssh_cmd "cd $PROJECT_DIR && docker compose up -d"

        sleep 5
        ssh_cmd "curl -sf http://localhost:8001/health && echo ' OK' || echo ' FAILED'"
        ;;

    full)
        echo ">>> Pulling latest code..."
        ssh_cmd "cd $PROJECT_DIR && git pull origin main"

        echo ">>> Full rebuild (no cache)..."
        ssh_cmd "cd $PROJECT_DIR && docker compose build --no-cache"

        echo ">>> Restarting..."
        ssh_cmd "cd $PROJECT_DIR && docker compose up -d"

        sleep 5
        ssh_cmd "curl -sf http://localhost:8001/health && echo ' OK' || echo ' FAILED'"
        ;;

    *)
        echo "Usage: $0 [backend|frontend|full]"
        exit 1
        ;;
esac

echo "=== Deploy complete ==="
