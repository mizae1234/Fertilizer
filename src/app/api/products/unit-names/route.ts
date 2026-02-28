import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const [productUnits, products] = await Promise.all([
        prisma.productUnit.findMany({
            select: { unitName: true },
            distinct: ['unitName'],
            orderBy: { unitName: 'asc' },
        }),
        prisma.product.findMany({
            where: { deletedAt: null },
            select: { unit: true },
            distinct: ['unit'],
            orderBy: { unit: 'asc' },
        }),
    ]);

    const names = new Set<string>();
    productUnits.forEach(u => { if (u.unitName.trim()) names.add(u.unitName.trim()); });
    products.forEach(p => { if (p.unit.trim()) names.add(p.unit.trim()); });

    return NextResponse.json([...names].sort());
}
