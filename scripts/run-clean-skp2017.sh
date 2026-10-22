#!/bin/bash
# ====================================================================
# Run clean script on skp2017 database (srv1422909.hstgr.cloud)
# ====================================================================
set -e

HOST="srv1422909.hstgr.cloud"
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/clean-skp2017.sql"

echo "⚠️  WARNING: You are about to clean all transactions, products, customers, and vendors from 'skp2017' database!"
echo "   Target host: $HOST"
echo "   Target DB:   skp2017"
echo ""

# Backup first
echo "📦 1. Creating safety backup on VPS..."
ssh root@$HOST "docker exec postgres-db pg_dump -U padmin skp2017 > /home/web/skp2017_backup_\$(date +%Y%m%d_%H%M%S).sql"

# Execute SQL
echo "🧹 2. Running clean script..."
ssh root@$HOST "docker exec -i postgres-db psql -U padmin -d skp2017" < "$SCRIPT_PATH"

echo "📊 3. Verifying remaining counts in skp2017..."
ssh root@$HOST "docker exec postgres-db psql -U padmin -d skp2017 -c '
SELECT 
  (SELECT count(*) FROM \"Sale\") as sales,
  (SELECT count(*) FROM \"GoodsReceive\") as grs,
  (SELECT count(*) FROM \"StockTransfer\") as transfers,
  (SELECT count(*) FROM \"Product\") as products,
  (SELECT count(*) FROM \"Customer\") as customers,
  (SELECT count(*) FROM \"Vendor\") as vendors,
  (SELECT count(*) FROM \"Warehouse\") as warehouses,
  (SELECT count(*) FROM \"ProductGroup\") as product_groups,
  (SELECT count(*) FROM \"User\") as users;
'"

echo ""
echo "✅ Database skp2017 cleaned successfully! Ready for fresh start."
