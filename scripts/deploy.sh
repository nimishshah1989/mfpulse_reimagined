#!/bin/bash
# MF Pulse — Smart deployment script
# Usage: ./scripts/deploy.sh [auto|frontend|backend|rebuild|full]
#
# auto      — detect what changed since last deploy, pick fastest mode (DEFAULT)
# frontend  — build Next.js on EC2, copy static files into container (~30s, no restart)
# backend   — sync Python code into container + restart (~10s)
# rebuild   — docker compose build with layer cache + restart (~1-2 min)
# full      — docker compose build --no-cache + restart (~3 min, deps/Dockerfile changes)
#
# The key insight: frontend is static HTML served by FastAPI.
# Changing frontend files only needs a new `pnpm build` + copy into container.
# No Docker rebuild, no container restart needed.

set -euo pipefail

MODE="${1:-auto}"
BRANCH="${2:-}"  # optional: branch to deploy (default: current branch on server)
REMOTE="ubuntu@13.206.34.214"
SSH_KEY="~/.ssh/jsl-wealth-key.pem"
PROJECT_DIR="/home/ubuntu/mfpulse_reimagined"
CONTAINER="mf-pulse"

ssh_cmd() {
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$REMOTE" "$1"
}

health_check() {
    echo ">>> Health check..."
    sleep 3
    if ssh_cmd "curl -sf http://localhost:8001/health > /dev/null 2>&1"; then
        echo "    OK"
    else
        echo "    FAILED — check logs: ssh $REMOTE 'docker logs $CONTAINER --tail 20'"
        exit 1
    fi
}

pull_code() {
    local branch_arg=""
    if [ -n "$BRANCH" ]; then
        branch_arg="git checkout $BRANCH && git pull origin $BRANCH"
    else
        branch_arg="git pull"
    fi
    echo ">>> Pulling latest code..."
    ssh_cmd "cd $PROJECT_DIR && $branch_arg"
}

detect_mode() {
    # Compare what changed between deployed commit and current HEAD
    local changes
    changes=$(ssh_cmd "cd $PROJECT_DIR && git diff HEAD@{1} --name-only 2>/dev/null || echo 'UNKNOWN'")

    if echo "$changes" | grep -q "UNKNOWN"; then
        echo "rebuild"  # can't detect, safe default
        return
    fi

    local has_backend=false has_frontend=false has_infra=false has_deps=false

    while IFS= read -r file; do
        case "$file" in
            Dockerfile*|docker-compose*|.dockerignore)  has_infra=true ;;
            backend/requirements.txt)                    has_deps=true ;;
            web/package.json|web/pnpm-lock.yaml)         has_deps=true ;;
            backend/*)                                   has_backend=true ;;
            web/*)                                       has_frontend=true ;;
            migrations/*)                                has_backend=true ;;
        esac
    done <<< "$changes"

    if $has_infra || $has_deps; then
        echo "rebuild"
    elif $has_backend && $has_frontend; then
        echo "both"
    elif $has_backend; then
        echo "backend"
    elif $has_frontend; then
        echo "frontend"
    else
        echo "frontend"  # docs/config only, safe no-op essentially
    fi
}

deploy_frontend() {
    echo ">>> Building frontend on EC2 (pnpm build)..."
    ssh_cmd "cd $PROJECT_DIR/web && pnpm install --frozen-lockfile 2>/dev/null && pnpm build"

    echo ">>> Copying static files into container..."
    ssh_cmd "docker exec $CONTAINER rm -rf /app/web/out && docker cp $PROJECT_DIR/web/out/. $CONTAINER:/app/web/out/"

    echo "    Frontend deployed (no restart needed — FastAPI serves static files)"
}

deploy_backend() {
    echo ">>> Syncing backend code into container..."
    ssh_cmd "docker cp $PROJECT_DIR/backend/app/. $CONTAINER:/app/app/"
    ssh_cmd "docker cp $PROJECT_DIR/scripts/. $CONTAINER:/app/scripts/"

    echo ">>> Restarting container..."
    ssh_cmd "docker restart $CONTAINER"

    health_check
}

deploy_rebuild() {
    echo ">>> Docker build (with layer cache)..."
    ssh_cmd "cd $PROJECT_DIR && docker compose build"

    echo ">>> Restarting..."
    ssh_cmd "cd $PROJECT_DIR && docker compose up -d"

    health_check
}

deploy_full() {
    echo ">>> Full Docker rebuild (no cache)..."
    ssh_cmd "cd $PROJECT_DIR && docker compose build --no-cache"

    echo ">>> Restarting..."
    ssh_cmd "cd $PROJECT_DIR && docker compose up -d"

    health_check
}

echo "=== MF Pulse Deploy ==="

# Auto mode: pull first, then detect
if [ "$MODE" = "auto" ]; then
    pull_code
    MODE=$(detect_mode)
    echo ">>> Auto-detected mode: $MODE"
else
    pull_code
fi

case "$MODE" in
    frontend)
        deploy_frontend
        ;;
    backend)
        deploy_backend
        ;;
    both)
        echo ">>> Both frontend and backend changed"
        deploy_frontend
        deploy_backend
        ;;
    rebuild)
        deploy_rebuild
        ;;
    full)
        deploy_full
        ;;
    *)
        echo "Usage: $0 [auto|frontend|backend|rebuild|full] [branch]"
        echo ""
        echo "Modes (fastest → slowest):"
        echo "  frontend  ~30s   Static files only, no restart"
        echo "  backend   ~10s   Python code sync + restart"
        echo "  rebuild   ~1-2m  Docker build with cache"
        echo "  full      ~3m    Docker build without cache"
        echo "  auto      ~varies  Detect changes and pick fastest mode"
        echo ""
        echo "Examples:"
        echo "  $0                              # auto-detect on current branch"
        echo "  $0 frontend                     # force frontend deploy"
        echo "  $0 auto feature/my-branch       # auto-detect on specific branch"
        exit 1
        ;;
esac

echo "=== Deploy complete ==="
