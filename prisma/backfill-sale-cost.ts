/**
 * Backfill SaleItem.unitCost from StockTransaction (GOODS_RECEIVE)
 * 
 * สำหรับแต่ละ SaleItem:
 * 1. ดึงวันที่ขาย (Sale.createdAt)
 * 2. หา StockTransaction type=GOODS_RECEIVE ของ productId ที่ createdAt ≤ วันขาย
 * 3. คำนวณ weighted avg cost = Σ(qty × unitCost) / Σ(qty)
 * 4. ถ้าไม่พบ GR → fallback ใช้ Product.cost ปัจจุบัน
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c timezone=Asia/Bangkok',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🔍 Fetching all SaleItems with unitCost = 0...');

  // Get all sale items that need backfill (unitCost is 0)
  const saleItems = await prisma.saleItem.findMany({
    where: { unitCost: 0 },
    select: {
      id: true,
      productId: true,
      warehouseId: true,
      sale: { select: { createdAt: true } },
    },
  });

  console.log(`📦 Found ${saleItems.length} SaleItems to backfill`);

  if (saleItems.length === 0) {
    console.log('✅ Nothing to do!');
    return;
  }

  // Cache: productId → { saleDate → avgCost }
  // We'll compute per unique (productId, saleDate) combination
  const costCache = new Map<string, number>();

  let updated = 0;
  let fallbackCount = 0;

  for (const item of saleItems) {
    const saleDate = item.sale.createdAt;
    const cacheKey = `${item.productId}_${saleDate.toISOString()}`;

    let avgCost: number;

    if (costCache.has(cacheKey)) {
      avgCost = costCache.get(cacheKey)!;
    } else {
      // Find all GOODS_RECEIVE transactions for this product before/at the sale date
      const grTransactions = await prisma.stockTransaction.findMany({
        where: {
          productId: item.productId,
          type: 'GOODS_RECEIVE',
          createdAt: { lte: saleDate },
        },
        select: {
          quantity: true,
          unitCost: true,
        },
      });

      if (grTransactions.length > 0) {
        // Weighted average cost
        let totalQty = 0;
        let totalCost = 0;
        for (const gr of grTransactions) {
          const qty = Math.abs(gr.quantity); // GR quantity is positive
          const cost = Number(gr.unitCost);
          totalQty += qty;
          totalCost += qty * cost;
        }
        avgCost = totalQty > 0 ? totalCost / totalQty : 0;
      } else {
        // Fallback: use current Product.cost
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { cost: true },
        });
        avgCost = product ? Number(product.cost) : 0;
        fallbackCount++;
      }

      costCache.set(cacheKey, avgCost);
    }

    // Update the SaleItem
    await prisma.saleItem.update({
      where: { id: item.id },
      data: { unitCost: parseFloat(avgCost.toFixed(2)) },
    });

    updated++;
    if (updated % 50 === 0) {
      console.log(`  📝 Updated ${updated}/${saleItems.length}...`);
    }
  }

  console.log(`\n✅ Backfill complete!`);
  console.log(`  📝 Updated: ${updated} SaleItems`);
  console.log(`  🔄 Used weighted avg from GR: ${updated - fallbackCount}`);
  console.log(`  ⚠️  Fallback to Product.cost: ${fallbackCount}`);
}

main()
  .catch(console.error)
  .finally(() => {
    pool.end();
  });
