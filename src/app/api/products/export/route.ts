import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
    const user = await getServerUser();
    const isStaff = user?.role === 'STAFF';
    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';
    const warehouse = searchParams.get('warehouse') || '';
    const group = searchParams.get('group') || '';

    const where: Record<string, unknown> = { deletedAt: null };

    const searchTokens = search.trim().split(/\s+/).filter(Boolean);
    if (searchTokens.length > 0) {
        where.AND = searchTokens.map(token => {
            const paddedToken = /^\d+$/.test(token) ? token.padStart(5, '0') : token;
            return {
                OR: [
                    { name: { contains: token, mode: 'insensitive' as const } },
                    { code: { contains: token, mode: 'insensitive' as const } },
                    ...(paddedToken !== token ? [{ code: { contains: paddedToken, mode: 'insensitive' as const } }] : []),
                    { brand: { contains: token, mode: 'insensitive' as const } },
                    { packaging: { contains: token, mode: 'insensitive' as const } },
                    { description: { contains: token, mode: 'insensitive' as const } },
                    { productGroup: { name: { contains: token, mode: 'insensitive' as const } } },
                ],
            };
        });
    }
    if (warehouse) {
        where.productStocks = { some: { warehouseId: warehouse, warehouse: { deletedAt: null, isActive: true } } };
    }
    if (group) {
        where.productGroupId = group;
    }

    const products = await prisma.product.findMany({
        where,
        include: {
            productGroup: { select: { name: true } },
            productStocks: {
                where: {
                    warehouse: { deletedAt: null, isActive: true },
                    ...(warehouse ? { warehouseId: warehouse } : {}),
                },
                select: { quantity: true, warehouse: { select: { name: true } } },
                orderBy: [{ warehouse: { isMain: 'desc' } }, { warehouse: { name: 'asc' } }],
            },
        },
        orderBy: { code: 'asc' },
    });

    const serialized = JSON.parse(JSON.stringify(products));
    if (isStaff) {
        serialized.forEach((p: any) => {
            p.cost = 0;
            p.costMethod = null;
        });
    }

    return NextResponse.json(serialized);
}
