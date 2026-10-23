#!/bin/bash
# ============================================================
# Deploy to all 5 Fertilizer POS sites (across 4 VPS servers)
# ============================================================
set -e

deploy_dir() {
    local host=$1
    local dir=$2
    local label=$3
    echo "📦 Deploying $label ($host: $dir) ..."
    ssh root@$host "cd $dir && \
        git fetch origin && \
        git reset --hard origin/main && \
        docker compose up -d --build && \
        docker run --rm --env-file .env --add-host host.docker.internal:host-gateway -v \$(pwd):/app -w /app node:22-alpine sh -c 'npm install --no-audit --no-fund 2>/dev/null && npx prisma db push --accept-data-loss'"
    echo "✅ Finished $label"
}

deploy_srv1422909() {
    # On srv1422909: deploy ptn95 then skp2017 sequentially to avoid CPU spike
    deploy_dir "srv1422909.hstgr.cloud" "/home/web/Fertilizer" "ptn95.tech"
    echo "📦 Deploying skp2017.tech (srv1422909.hstgr.cloud: /home/web/skp2017) ..."
    ssh root@srv1422909.hstgr.cloud "cd /home/web/skp2017 && \
        git fetch origin && \
        git reset --hard origin/main && \
        docker compose up -d --build web && \
        docker network connect --alias skp2017-web fertilizer_default skp2017-web-1 2>/dev/null || true && \
        docker run --rm --env-file .env --add-host host.docker.internal:host-gateway -v \$(pwd):/app -w /app node:22-alpine sh -c 'npm install --no-audit --no-fund 2>/dev/null && npx prisma db push --accept-data-loss'"
    echo "✅ Finished skp2017.tech"
}

echo "🚀 Deploying to all 5 sites across 4 servers..."
echo ""

# Deploy across servers in parallel
deploy_dir "srv1422918.hstgr.cloud" "/home/web/Fertilizer" "bflk.tech" &
deploy_srv1422909 &
deploy_dir "srv1422922.hstgr.cloud" "/home/web/Fertilizer" "a-chemikaset.tech" &
deploy_dir "srv1422927.hstgr.cloud" "/home/web/Fertilizer" "ptn95bsp.tech" &

echo "⏳ Waiting for all deployments to finish..."
wait
echo ""
echo "🎉 All 5 deployments complete!"

