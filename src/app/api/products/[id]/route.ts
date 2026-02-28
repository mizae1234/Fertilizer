import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            productGroup: { select: { name: true } },
            productStocks: {
                include: { warehouse: { select: { id: true, name: true } } },
            },
            productPrices: {
                include: { customerGroup: { select: { name: true } } },
            },
            productUnits: {
                orderBy: [{ isBaseUnit: 'desc' }, { conversionRate: 'asc' }],
            },
            stockTransactions: {
                include: { warehouse: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 50,
            },
        },
    });

    if (!product) {
        return NextResponse.json({ error: 'ไม่พบสินค้า' }, { status: 404 });
    }

    // Serialize Decimal objects to plain values
    return NextResponse.json(JSON.parse(JSON.stringify(product)));
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();

    // Only allow known Product scalar fields
    const allowedFields = [
        'name', 'description', 'unit', 'cost', 'price', 'brand',
        'packaging', 'productGroupId', 'pointsPerUnit', 'minStock', 'isActive', 'code', 'imageUrl'
    ];
    const data: Record<string, any> = {};
    for (const key of allowedFields) {
        if (key in body) {
            data[key] = body[key];
        }
    }

    try {
        const updated = await prisma.product.update({
            where: { id },
            data,
        });
        return NextResponse.json(JSON.parse(JSON.stringify(updated)));
    } catch (error: any) {
        console.error('Product PATCH error:', error.message, JSON.stringify(data));
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
