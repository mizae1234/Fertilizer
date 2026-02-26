import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const products = await prisma.product.findMany({
        where: { brand: { not: null } },
        select: { brand: true },
        distinct: ['brand'],
        orderBy: { brand: 'asc' },
    });
    const brands = products.map(p => p.brand).filter(Boolean);
    return NextResponse.json(brands);
}
