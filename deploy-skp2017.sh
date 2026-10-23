#!/bin/bash
# ============================================
# Deploy to skp2017.tech (srv1422909.hstgr.cloud)
# ============================================
set -e

HOST="srv1422909.hstgr.cloud"
APP_DIR="/home/web/skp2017"

echo "🚀 Deploying to skp2017.tech ($HOST)..."
ssh root@$HOST "cd $APP_DIR && \
  git fetch origin && \
  git reset --hard origin/main && \
  docker compose up -d --build web && \
  docker network connect --alias skp2017-web fertilizer_default skp2017-web-1 2>/dev/null || true && \
  docker run --rm --env-file .env --add-host host.docker.internal:host-gateway -v \$(pwd):/app -w /app node:22-alpine sh -c 'npm install --no-audit --no-fund 2>/dev/null && npx prisma db push --accept-data-loss'"

echo ""
echo "✅ Deployment to skp2017.tech complete!"
