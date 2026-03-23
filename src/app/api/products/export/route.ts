import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';
    const warehouse = searchParams.get('warehouse') || '';
    const group = searchParams.get('group') || '';

    const where: Record<string, unknown> = { deletedAt: null };

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' as const } },
            { code: { contains: search, mode: 'insensitive' as const } },
            { brand: { contains: search, mode: 'insensitive' as const } },
        ];
    }
    if (warehouse) {
        where.productStocks = { some: { warehouseId: warehouse } };
    }
    if (group) {
        where.productGroupId = group;
    }

    const products = await prisma.product.findMany({
        where,
        include: {
            productGroup: { select: { name: true } },
            productStocks: {
                select: { quantity: true, warehouse: { select: { name: true } } },
                ...(warehouse ? { where: { warehouseId: warehouse } } : {}),
            },
        },
        orderBy: { code: 'asc' },
    });

    return NextResponse.json(products);
}
