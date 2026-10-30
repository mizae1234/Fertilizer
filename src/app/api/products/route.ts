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
            const trimmed = exactCode.trim();
            const padded = /^\d+$/.test(trimmed) ? trimmed.padStart(5, '0') : trimmed;
            where.OR = [
                { code: { equals: trimmed, mode: 'insensitive' } },
                ...(padded !== trimmed ? [{ code: { equals: padded, mode: 'insensitive' } }] : []),
            ];
        } else if (search) {
            const tokens = search.trim().split(/\s+/).filter(Boolean);
            if (tokens.length > 0) {
                where.AND = tokens.map(token => {
                    const paddedToken = /^\d+$/.test(token) ? token.padStart(5, '0') : token;
                    return {
                        OR: [
                            { name: { contains: token, mode: 'insensitive' } },
                            { code: { contains: token, mode: 'insensitive' } },
                            ...(paddedToken !== token ? [{ code: { contains: paddedToken, mode: 'insensitive' } }] : []),
                            { brand: { contains: token, mode: 'insensitive' } },
                            { packaging: { contains: token, mode: 'insensitive' } },
                            { description: { contains: token, mode: 'insensitive' } },
                            { productGroup: { name: { contains: token, mode: 'insensitive' } } },
                        ]
                    };
                });
            }
        }

        const products = await prisma.product.findMany({
            where,
            select: {
                id: true, code: true, name: true, price: true, cost: true, unit: true,
                description: true, brand: true, packaging: true,
                imageUrl: true, pointsPerUnit: true, minStock: true,
                productGroup: { select: { id: true, name: true } },
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
            ...(search ? { take: 200 } : {}),
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
