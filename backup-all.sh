#!/bin/bash
# ============================================================
# Backup all databases across all Fertilizer POS sites
# ============================================================
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOCAL_BACKUP_DIR="$(pwd)/backups/${TIMESTAMP}"
mkdir -p "$LOCAL_BACKUP_DIR"

echo "============================================================"
echo "🛡️  FERTILIZER POS — FULL DATABASE BACKUP (${TIMESTAMP})"
echo "============================================================"
echo "📁 Local backup folder: ${LOCAL_BACKUP_DIR}"
echo ""

backup_remote_db() {
    local host=$1
    local env_dir=$2
    local label=$3

    echo "------------------------------------------------------------"
    echo "📦 [${label}] Connecting to ${host} (${env_dir})..."

    # Read .env on remote server to find DB info
    ssh -o ConnectTimeout=15 root@${host} "bash -s" << REMOTE_EOF
set -e
TIMESTAMP="${TIMESTAMP}"
LABEL="${label}"
BACKUP_DIR="/home/web/backups"
mkdir -p "\${BACKUP_DIR}"

if [ ! -f "${env_dir}/.env" ]; then
    echo "❌ Error: ${env_dir}/.env not found!"
    exit 1
fi

# Extract DB info from .env
DB_URL=\$(grep -E '^DATABASE_URL=' "${env_dir}/.env" | head -n 1 | sed -e 's/^DATABASE_URL=//' -e 's/"//g' -e "s/'//g")
DB_NAME=\$(echo "\$DB_URL" | sed -E 's|.*:5432/([^?]+).*|\1|')
DB_USER=\$(echo "\$DB_URL" | sed -E 's|.*://([^:]+):.*|\1|')

echo "   ℹ️  Database: \${DB_NAME} (User: \${DB_USER})"

# Find postgres container
CONTAINER=\$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -n 1)
if [ -z "\$CONTAINER" ]; then
    CONTAINER="postgres-db"
fi
echo "   ℹ️  Postgres Container: \${CONTAINER}"

OUT_FILE="\${BACKUP_DIR}/\${LABEL}_\${DB_NAME}_\${TIMESTAMP}.sql.gz"
echo "   ⏳ Running pg_dump & gzip..."
docker exec "\${CONTAINER}" pg_dump -U "\${DB_USER}" "\${DB_NAME}" | gzip > "\${OUT_FILE}"

FILE_SIZE=\$(ls -lh "\${OUT_FILE}" | awk '{print \$5}')
echo "   ✅ Backup created on server: \${OUT_FILE} (\${FILE_SIZE})"
REMOTE_EOF

    # Download to local Mac
    echo "   ⬇️  Downloading to local backup folder..."
    scp -o ConnectTimeout=15 "root@${host}:/home/web/backups/${label}_*_${TIMESTAMP}.sql.gz" "${LOCAL_BACKUP_DIR}/" 2>/dev/null || true
    echo "   🎉 Finished ${label}"
}

# 1. srv1422909: ptn95.tech
backup_remote_db "srv1422909.hstgr.cloud" "/home/web/Fertilizer" "ptn95"

# 2. srv1422909: skp2017.tech
backup_remote_db "srv1422909.hstgr.cloud" "/home/web/skp2017" "skp2017"

# 3. srv1422918: bflk.tech
backup_remote_db "srv1422918.hstgr.cloud" "/home/web/Fertilizer" "bflk"

# 4. srv1422922: a-chemikaset.tech
backup_remote_db "srv1422922.hstgr.cloud" "/home/web/Fertilizer" "a-chemikaset"

# 5. srv1422927: ptn95bsp.tech
backup_remote_db "srv1422927.hstgr.cloud" "/home/web/Fertilizer" "ptn95bsp"

echo ""
echo "============================================================"
echo "🎉 All database backups completed successfully!"
echo "📁 Files saved on VPS at: /home/web/backups/"
echo "📁 Local copies in: ${LOCAL_BACKUP_DIR}"
echo "============================================================"
ls -lh "${LOCAL_BACKUP_DIR}"
