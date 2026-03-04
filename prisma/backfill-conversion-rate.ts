import { readFileSync } from 'fs';
import { resolve } from 'path';

// Only load .env if DATABASE_URL not already set via environment
if (!process.env.DATABASE_URL) {
    const envFile = readFileSync(resolve(__dirname, '../.env'), 'utf8');
    for (const line of envFile.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const val = match[2].trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = val;
        }
    }
}

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

async function backfill() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        options: '-c timezone=Asia/Bangkok',
    });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter } as any);

    // Find all SaleItems with a unitName (= sold in non-base unit)
    const saleItemsWithUnit = await prisma.saleItem.findMany({
        where: {
            unitName: { not: null },
            conversionRate: 1, // only backfill ones still at default
        },
        select: {
            id: true,
            productId: true,
            unitName: true,
        },
    });

    console.log(`Found ${saleItemsWithUnit.length} SaleItem(s) to backfill`);

    let updated = 0;
    let skipped = 0;

    for (const si of saleItemsWithUnit) {
        if (!si.unitName) { skipped++; continue; }

        // Look up conversion rate from ProductUnit
        const productUnit = await prisma.productUnit.findUnique({
            where: {
                productId_unitName: {
                    productId: si.productId,
                    unitName: si.unitName,
                },
            },
            select: { conversionRate: true },
        });

        if (!productUnit) {
            console.log(`  SKIP: SaleItem ${si.id} — ProductUnit not found for "${si.unitName}" / product ${si.productId}`);
            skipped++;
            continue;
        }

        const rate = Number(productUnit.conversionRate);
        if (rate === 1) {
            skipped++;
            continue;
        }

        await prisma.saleItem.update({
            where: { id: si.id },
            data: { conversionRate: rate },
        });

        console.log(`  UPDATED: SaleItem ${si.id} → conversionRate = ${rate} (unit: ${si.unitName})`);
        updated++;
    }

    console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`);

    await prisma.$disconnect();
    await pool.end();
}

backfill().catch(e => {
    console.error('Backfill error:', e);
    process.exit(1);
});
