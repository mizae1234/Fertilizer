import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
} as any);

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
  .finally(() => prisma.$disconnect());
