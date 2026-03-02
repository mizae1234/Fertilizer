#!/bin/bash
# Deploy to all 4 Fertilizer POS sites simultaneously

SITES=(
    "srv1422918.hstgr.cloud"  # bflk.tech
    "srv1422909.hstgr.cloud"  # ptn95.tech
    "srv1422922.hstgr.cloud"  # ptn95td.tech
    "srv1422927.hstgr.cloud"  # ptn95bsp.tech
)

echo "🚀 Deploying to ${#SITES[@]} sites..."
echo ""

for HOST in "${SITES[@]}"; do
    echo "📦 Deploying to $HOST ..."
    ssh root@$HOST "cd /home/web/Fertilizer && git fetch origin && git reset --hard origin/main && docker compose down && docker compose up -d --build" &
done

echo ""
echo "⏳ Waiting for all deployments to finish..."
wait
echo ""
echo "✅ All deployments complete!"
