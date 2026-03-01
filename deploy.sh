#!/bin/bash
# ============================================
# Fertilizer POS — Deploy to all VPS
# ============================================
# Usage: ./deploy.sh [site1|site2|site3|site4|all]
#
# Prerequisites:
#   - SSH key-based authentication configured
#   - Each VPS has the repo cloned at APP_DIR
#   - .env already configured on each VPS

set -e

# ── Configure your VPS servers here ──
declare -A SERVERS
SERVERS[site1]="user@vps1-ip"
SERVERS[site2]="user@vps2-ip"
SERVERS[site3]="user@vps3-ip"
SERVERS[site4]="user@vps4-ip"

APP_DIR="/opt/fertilizer"
BRANCH="main"

deploy_site() {
    local name=$1
    local server=${SERVERS[$name]}
    
    if [ -z "$server" ]; then
        echo "❌ ไม่พบ server: $name"
        return 1
    fi

    echo ""
    echo "══════════════════════════════════════"
    echo "🚀 Deploying to $name ($server)"
    echo "══════════════════════════════════════"
    
    ssh "$server" << ENDSSH
        cd $APP_DIR
        echo "📥 Pulling latest code..."
        git fetch origin $BRANCH
        git reset --hard origin/$BRANCH
        
        echo "🔨 Building & restarting..."
        docker compose up -d --build --remove-orphans
        
        echo "🗄️ Running migrations..."
        docker compose exec -T web npx prisma migrate deploy
        
        echo "✅ $name deployed successfully!"
ENDSSH
    
    echo "✅ $name done!"
}

# ── Main ──
TARGET=${1:-all}

if [ "$TARGET" = "all" ]; then
    for site in "${!SERVERS[@]}"; do
        deploy_site "$site"
    done
    echo ""
    echo "🎉 All sites deployed!"
else
    deploy_site "$TARGET"
fi
