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
  console.log('🔍 Fetching all ProductStocks with avgCost = 0...');

  const stocks = await prisma.productStock.findMany({
    where: { avgCost: 0 },
    include: {
      product: { select: { cost: true, name: true } },
      warehouse: { select: { name: true } },
    },
  });

  console.log(`📦 Found ${stocks.length} ProductStock records with avgCost = 0`);

  if (stocks.length === 0) {
    console.log('✅ Nothing to do!');
    return;
  }

  let updatedCount = 0;

  for (const stock of stocks) {
    // 1. Try to find if this product has a non-zero avgCost in another warehouse
    const otherStock = await prisma.productStock.findFirst({
      where: {
        productId: stock.productId,
        avgCost: { gt: 0 },
      },
      select: { avgCost: true },
    });

    let costToUse = 0;
    if (otherStock) {
      costToUse = Number(otherStock.avgCost);
    } else {
      // 2. Fallback to product.cost
      costToUse = Number(stock.product.cost || 0);
    }

    if (costToUse > 0) {
      await prisma.productStock.update({
        where: { id: stock.id },
        data: { avgCost: costToUse },
      });
      console.log(`Updated ${stock.product.name} in ${stock.warehouse.name} to cost ${costToUse}`);
      updatedCount++;
    }
  }

  console.log(`✅ Backfill complete. Updated ${updatedCount} records.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
