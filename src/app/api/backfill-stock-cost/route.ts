import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('🔍 Fetching all ProductStocks with avgCost = 0...');

    const stocks = await prisma.productStock.findMany({
      where: { avgCost: 0 },
      include: {
        product: { select: { cost: true, name: true } },
        warehouse: { select: { name: true } },
      },
    });

    const logs: string[] = [];
    logs.push(`Found ${stocks.length} ProductStock records with avgCost = 0`);

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
        const logMsg = `Updated ${stock.product.name} in ${stock.warehouse.name} to cost ${costToUse}`;
        console.log(logMsg);
        logs.push(logMsg);
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfill complete. Updated ${updatedCount} records.`,
      logs,
    });
  } catch (error: any) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { success: false, error: error.message || String(error) },
      { status: 500 }
    );
  }
}
