import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const products = await prisma.product.findMany({
        where: { deletedAt: null },
        include: {
            productGroup: { select: { name: true } },
            productStocks: {
                select: { quantity: true, warehouse: { select: { name: true } } },
            },
        },
        orderBy: { code: 'asc' },
    });

    return NextResponse.json(products);
}
