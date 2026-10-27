import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/server-auth';

export async function GET(request: Request) {
    try {
        const user = await getServerUser();
        const isStaff = user?.role === 'STAFF';
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const exactCode = searchParams.get('exactCode') || '';
        const warehouseId = searchParams.get('warehouseId') || '';

        const where: any = {
            deletedAt: null,
            isActive: true,
        };

        if (exactCode) {
            where.code = { equals: exactCode, mode: 'insensitive' };
        } else if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const products = await prisma.product.findMany({
            where,
            select: {
                id: true, code: true, name: true, price: true, cost: true, unit: true,
                description: true,
                imageUrl: true, pointsPerUnit: true, minStock: true,
                productStocks: warehouseId
                    ? { where: { warehouseId, warehouse: { deletedAt: null, isActive: true } }, select: { warehouseId: true, quantity: true } }
                    : { where: { warehouse: { deletedAt: null, isActive: true } }, select: { warehouseId: true, quantity: true } },
                productPrices: {
                    select: { price: true, productUnitId: true, customerGroup: { select: { name: true, id: true } } },
                },
                productUnits: {
                    select: { id: true, unitName: true, conversionRate: true, sellingPrice: true, isBaseUnit: true },
                    orderBy: [{ isBaseUnit: 'desc' }, { conversionRate: 'asc' }],
                },
            },
            take: 2000,
            orderBy: { name: 'asc' },
        });

        const serialized = JSON.parse(JSON.stringify(products));
        if (isStaff) {
            serialized.forEach((p: any) => {
                p.cost = 0;
            });
        }

        return NextResponse.json(serialized);
    } catch (error: any) {
        console.error('GET /api/products ERROR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
