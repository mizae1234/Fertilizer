import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const warehouseId = searchParams.get('warehouseId') || '';

        const products = await prisma.product.findMany({
            where: {
                deletedAt: null,
                ...(search
                    ? {
                        OR: [
                            { name: { contains: search, mode: 'insensitive' } },
                            { code: { contains: search, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
            },
            include: {
                productStocks: warehouseId
                    ? { where: { warehouseId } }
                    : true,
                productPrices: {
                    include: { customerGroup: { select: { name: true, id: true } } },
                },
                productUnits: {
                    orderBy: [{ isBaseUnit: 'desc' }, { conversionRate: 'asc' }],
                },
            },
            take: 50,
            orderBy: { name: 'asc' },
        });

        // Serialize Decimal objects to plain values
        return NextResponse.json(JSON.parse(JSON.stringify(products)));
    } catch (error: any) {
        console.error('GET /api/products ERROR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
