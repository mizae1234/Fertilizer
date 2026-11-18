import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/server-auth';

export async function GET(request: Request) {
    try {
        const user = await getServerUser();
        const isStaff = user?.role === 'STAFF';
        const { searchParams } = new URL(request.url);
        const checkBarcode = searchParams.get('checkBarcode');
        const excludeId = searchParams.get('excludeId') || '';

        if (checkBarcode !== null) {
            const trimmedBarcode = checkBarcode.trim();
            if (!trimmedBarcode) {
                return NextResponse.json({ duplicate: null });
            }
            const duplicate = await prisma.product.findFirst({
                where: {
                    barcode: { equals: trimmedBarcode, mode: 'insensitive' },
                    deletedAt: null,
                    ...(excludeId ? { id: { not: excludeId } } : {}),
                },
                select: { id: true, code: true, name: true, barcode: true },
            });
            return NextResponse.json({ duplicate: duplicate || null });
        }

        const search = searchParams.get('search') || '';
        const exactCode = searchParams.get('exactCode') || '';
        const warehouseId = searchParams.get('warehouseId') || '';
        const productGroupId = searchParams.get('productGroupId') || '';
        const brand = searchParams.get('brand') || '';
        const limit = searchParams.get('limit');
        const includeInactive = searchParams.get('includeInactive') === '1';
        const lite = searchParams.get('lite') === '1';

        const andConditions: any[] = [];
        const where: any = {
            deletedAt: null,
            ...(includeInactive ? {} : { isActive: true }),
        };

        if (productGroupId === '__NONE__') {
            where.productGroupId = null;
        } else if (productGroupId) {
            where.productGroupId = productGroupId;
        }

        if (brand === '__NONE__') {
            andConditions.push({
                OR: [{ brand: null }, { brand: '' }],
            });
        } else if (brand) {
            where.brand = { equals: brand, mode: 'insensitive' };
        }

        if (exactCode) {
            const trimmed = exactCode.trim();
            const padded = /^\d+$/.test(trimmed) ? trimmed.padStart(5, '0') : trimmed;
            andConditions.push({
                OR: [
                    { code: { equals: trimmed, mode: 'insensitive' } },
                    { barcode: { equals: trimmed, mode: 'insensitive' } },
                    ...(padded !== trimmed ? [{ code: { equals: padded, mode: 'insensitive' } }] : []),
                ],
            });
        } else if (search) {
            const tokens = search.trim().split(/\s+/).filter(Boolean);
            if (tokens.length > 0) {
                for (const token of tokens) {
                    const paddedToken = /^\d+$/.test(token) ? token.padStart(5, '0') : token;
                    andConditions.push({
                        OR: [
                            { name: { contains: token, mode: 'insensitive' } },
                            { code: { contains: token, mode: 'insensitive' } },
                            ...(paddedToken !== token ? [{ code: { contains: paddedToken, mode: 'insensitive' } }] : []),
                            { barcode: { contains: token, mode: 'insensitive' } },
                            { brand: { contains: token, mode: 'insensitive' } },
                            { packaging: { contains: token, mode: 'insensitive' } },
                            { description: { contains: token, mode: 'insensitive' } },
                            { posNote: { contains: token, mode: 'insensitive' } },
                            { productGroup: { is: { name: { contains: token, mode: 'insensitive' } } } },
                        ],
                    });
                }
            }
        }

        if (andConditions.length > 0) {
            where.AND = andConditions;
        }

        const parsedLimit = limit ? parseInt(limit) : (search && !productGroupId && !brand && !includeInactive ? 200 : undefined);

        const products = await prisma.product.findMany({
            where,
            select: lite
                ? {
                    id: true, code: true, barcode: true, name: true, unit: true, brand: true, posNote: true,
                    productGroup: { select: { id: true, name: true } },
                    productStocks: warehouseId
                        ? { where: { warehouseId, warehouse: { deletedAt: null, isActive: true } }, select: { warehouseId: true, quantity: true } }
                        : { where: { warehouse: { deletedAt: null, isActive: true } }, select: { warehouseId: true, quantity: true } },
                }
                : {
                    id: true, code: true, barcode: true, name: true, price: true, cost: true, unit: true,
                    description: true, posNote: true, brand: true, packaging: true,
                    imageUrl: true, pointsPerUnit: true, minStock: true,
                    mfgDate: true, expDate: true,
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
                    priceTiers: {
                        select: { id: true, productUnitId: true, minQuantity: true, price: true },
                        orderBy: { minQuantity: 'asc' },
                    },
                },
            ...(parsedLimit ? { take: parsedLimit } : {}),
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
