#!/bin/bash
# ============================================
# Fertilizer POS — First-time setup on a new VPS
# ============================================
# Usage: ssh into VPS, then run:
#   chmod +x setup.sh && ./setup.sh
#
# This script will:
#   1. Clone the repo
#   2. Create .env from template
#   3. Build & start containers
#   4. Run DB migrations
#   5. Seed with admin user

set -e

APP_DIR="/opt/fertilizer"
REPO_URL="https://github.com/mizae1234/Fertilizer.git"

echo "══════════════════════════════════════"
echo "🏭 Fertilizer POS — First-time Setup"
echo "══════════════════════════════════════"
echo ""

# 1. Clone repo
if [ -d "$APP_DIR" ]; then
    echo "📁 Directory $APP_DIR already exists, pulling latest..."
    cd "$APP_DIR"
    git pull
else
    echo "📥 Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# 2. Create .env
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env

    # Generate random passwords
    PG_PASS=$(openssl rand -base64 24 | tr -d '=+/' | head -c 24)
    JWT_SEC=$(openssl rand -base64 32 | tr -d '=+/' | head -c 32)

    # Replace placeholders
    sed -i "s/CHANGE_ME_strong_password_here/$PG_PASS/" .env
    sed -i "s/CHANGE_ME_random_32_char_secret_here/$JWT_SEC/" .env

    echo "✅ .env created with random passwords"
    echo "   POSTGRES_PASSWORD=$PG_PASS"
    echo "   JWT_SECRET=$JWT_SEC"
    echo ""
    echo "⚠️  กรุณาแก้ไข Caddyfile ใส่ domain ของ site นี้!"
    echo "   nano Caddyfile"
    echo ""
    read -p "กด Enter เมื่อแก้ไข Caddyfile เรียบร้อยแล้ว..."
else
    echo "✅ .env already exists, skipping..."
fi

# 3. Build & start
echo ""
echo "🔨 Building containers..."
docker compose up -d --build

# 4. Wait for DB to be ready
echo "⏳ Waiting for database..."
sleep 5

# 5. Run migrations
echo "🗄️ Running database migrations..."
docker compose exec -T web npx prisma migrate deploy

# 6. Seed production data
echo "🌱 Seeding initial data..."
docker compose exec -T web npx tsx prisma/seed-production.ts

echo ""
echo "══════════════════════════════════════"
echo "🎉 Setup complete!"
echo "══════════════════════════════════════"
echo ""
echo "📧 Login: admin / admin123"
echo "⚠️  เปลี่ยนรหัสผ่านทันทีหลังเข้าระบบครั้งแรก!"
echo ""
echo "🔧 Commands:"
echo "   docker compose logs -f     # ดู logs"
echo "   docker compose restart     # restart"
echo "   docker compose down        # หยุดทั้งหมด"
echo ""
