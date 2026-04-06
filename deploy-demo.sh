#!/bin/bash
# ============================================
# Fertilizer POS — Deploy DEMO Site
# ============================================
# Target: fertilizer.popcorn-creator.com
# Server: srv1100100.hstgr.cloud
# Path:   /home/web/FertilizerDemo
# Port:   3008
# ============================================
# ⚠️  ห้ามแก้ไข deploy-all.sh เด็ดขาด!
# ============================================

set -e

SERVER="root@srv1100100.hstgr.cloud"
APP_DIR="/home/web/FertilizerDemo"
DOMAIN="fertilizer.popcorn-creator.com"
PORT=3008
REPO_URL="https://github.com/mizae1234/Fertilizer.git"
# Docker container uses host.docker.internal to reach host's PostgreSQL
DB_URL_DOCKER='postgresql://pop_user:%40Kanitta12PRD@host.docker.internal:5432/fertilizer_demo?schema=public&options=-c%20timezone%3DAsia%2FBangkok'
# Host uses localhost to reach PostgreSQL
DB_URL_HOST='postgresql://pop_user:%40Kanitta12PRD@localhost:5432/fertilizer_demo?schema=public&options=-c%20timezone%3DAsia%2FBangkok'

echo "══════════════════════════════════════"
echo "🚀 Fertilizer Demo — Deploying to $DOMAIN"
echo "══════════════════════════════════════"
echo ""

ssh "$SERVER" bash -s -- "$APP_DIR" "$DOMAIN" "$PORT" "$REPO_URL" "$DB_URL_DOCKER" "$DB_URL_HOST" << 'ENDSSH'
APP_DIR="$1"
DOMAIN="$2"
PORT="$3"
REPO_URL="$4"
DB_URL_DOCKER="$5"
DB_URL_HOST="$6"

set -e

# ── 1. Clone or pull repo ──
echo ""
echo "📥 Step 1: Clone/Pull repository..."
if [ -d "$APP_DIR" ]; then
    echo "   Directory exists, pulling latest..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main
else
    echo "   Cloning fresh..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi
echo "✅ Code ready"

# ── 2. Create .env ──
echo ""
echo "📝 Step 2: Creating .env..."
cat > .env << ENVEOF
DATABASE_URL="$DB_URL_DOCKER"
TZ=Asia/Bangkok
ENVEOF
echo "✅ .env created"

# ── 3. Create docker-compose.yml (port $PORT, no Caddy) ──
echo ""
echo "🐳 Step 3: Creating docker-compose.yml (port $PORT)..."
cat > docker-compose.yml << DCEOF
services:
  web:
    build: .
    restart: unless-stopped
    env_file:
      - .env
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "${PORT}:3000"
    volumes:
      - uploads_data:/app/uploads

volumes:
  uploads_data:
DCEOF
echo "✅ docker-compose.yml created"

# ── 4. Build & start Docker ──
echo ""
echo "🔨 Step 4: Building & starting Docker containers..."
docker compose down 2>/dev/null || true
docker compose up -d --build
echo "✅ Docker containers running"

# ── 5. Wait for container to be ready ──
echo ""
echo "⏳ Step 5: Waiting for container to start..."
sleep 5

# ── 6. Push schema to empty DB (run from host with localhost URL) ──
echo ""
echo "🗄️ Step 6: Pushing Prisma schema to database..."
npm install 2>&1 | tail -3
npx prisma generate 2>&1 | tail -3
npx prisma db push --url "$DB_URL_HOST"
echo "✅ Schema created"

# ── 7. Run demo seed (run from host) ──
echo ""
echo "🌱 Step 7: Running demo seed..."
DATABASE_URL="$DB_URL_HOST" npx tsx prisma/seed-demo.ts
echo "✅ Demo data seeded"

# ── 8. Setup Nginx + SSL ──
echo ""
echo "🔒 Step 8: Setting up Nginx + SSL..."

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "   Installing certbot..."
    apt-get update -qq && apt-get install -y -qq certbot python3-certbot-nginx
fi

# Create Nginx config
cat > /etc/nginx/sites-available/$DOMAIN << NGEOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        client_max_body_size 20M;
    }
}
NGEOF

# Enable site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN

# Test and reload Nginx
nginx -t && systemctl reload nginx
echo "✅ Nginx configured"

# Get SSL certificate
echo "   Requesting SSL certificate..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@popcorn-creator.com --redirect 2>/dev/null || echo "⚠️  SSL may already exist or failed — check manually"
echo "✅ SSL setup complete"

echo ""
echo "══════════════════════════════════════"
echo "🎉 Deployment Complete!"
echo "══════════════════════════════════════"
echo ""
echo "🌐 URL: https://$DOMAIN"
echo "📧 Login:"
echo "   Admin: admin / admin123"
echo "   Staff: demo / demo123"
echo ""
echo "🔧 Commands:"
echo "   cd $APP_DIR"
echo "   docker compose logs -f"
echo "   docker compose restart"
echo ""
ENDSSH

echo ""
echo "🎉 Demo site deployed to https://$DOMAIN"
