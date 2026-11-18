import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/server-auth';
import { cleanSearchText, roundQty } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface LowStockRow {
    id: string;
    productId: string;
    warehouseId: string;
    quantity: number;
    code: string;
    barcode: string | null;
    name: string;
    brand: string | null;
    unit: string;
    minStock: number;
    price: number;
    cost: number;
    category: string | null;
    warehouseName: string;
}

export async function GET(request: NextRequest) {
    const user = await getServerUser();
    if (!user) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบใหม่' }, { status: 401 });
    }

    const isAdmin = user.role === 'ADMIN';
    const { searchParams } = request.nextUrl;
    const rawSearch = searchParams.get('search') || '';
    const warehouseId = searchParams.get('warehouseId') || '';
    const exportAll = searchParams.get('exportAll') === '1';
    const includeWarehouses = searchParams.get('includeWarehouses') === '1';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(5, parseInt(searchParams.get('perPage') || '15', 10) || 15));

    const searchTokens = cleanSearchText(rawSearch).split(/\s+/).filter(Boolean);

    const conditions: Prisma.Sql[] = [
        Prisma.sql`p."deletedAt" IS NULL`,
        Prisma.sql`p."isActive" = true`,
        Prisma.sql`w."deletedAt" IS NULL`,
        Prisma.sql`w."isActive" = true`,
        Prisma.sql`ps."quantity" < p."minStock"`,
    ];

    if (warehouseId) {
        conditions.push(Prisma.sql`ps."warehouseId" = ${warehouseId}`);
    }

    for (const token of searchTokens) {
        const pattern = `%${token}%`;
        const padded = /^\d+$/.test(token) ? `%${token.padStart(5, '0')}%` : null;
        if (padded && padded !== pattern) {
            conditions.push(Prisma.sql`(
                p."name" ILIKE ${pattern}
                OR p."code" ILIKE ${pattern}
                OR p."code" ILIKE ${padded}
                OR COALESCE(p."barcode", '') ILIKE ${pattern}
                OR COALESCE(p."brand", '') ILIKE ${pattern}
                OR COALESCE(pg."name", '') ILIKE ${pattern}
            )`);
        } else {
            conditions.push(Prisma.sql`(
                p."name" ILIKE ${pattern}
                OR p."code" ILIKE ${pattern}
                OR COALESCE(p."barcode", '') ILIKE ${pattern}
                OR COALESCE(p."brand", '') ILIKE ${pattern}
                OR COALESCE(pg."name", '') ILIKE ${pattern}
            )`);
        }
    }

    const whereSql = Prisma.join(conditions, ' AND ');

    if (exportAll) {
        const rows = await prisma.$queryRaw<LowStockRow[]>`
            SELECT
                ps."id",
                ps."productId",
                ps."warehouseId",
                ps."quantity"::float8 AS "quantity",
                p."code",
                p."barcode",
                p."name",
                p."brand",
                p."unit",
                p."minStock"::float8 AS "minStock",
                p."price"::float8 AS "price",
                p."cost"::float8 AS "cost",
                pg."name" AS "category",
                w."name" AS "warehouseName"
            FROM "ProductStock" ps
            JOIN "Product" p ON p."id" = ps."productId"
            JOIN "Warehouse" w ON w."id" = ps."warehouseId"
            LEFT JOIN "ProductGroup" pg ON pg."id" = p."productGroupId"
            WHERE ${whereSql}
            ORDER BY ps."quantity" ASC, p."name" ASC
        `;

        const items = rows.map(r => {
            const qty = roundQty(Number(r.quantity));
            const min = roundQty(Number(r.minStock));
            return {
                id: r.id,
                productId: r.productId,
                code: r.code,
                barcode: r.barcode || '',
                name: r.name,
                category: r.category || '',
                brand: r.brand || '',
                unit: r.unit,
                warehouseId: r.warehouseId,
                warehouseName: r.warehouseName,
                quantity: qty,
                minStock: min,
                shortage: roundQty(Math.max(0, min - qty)),
                price: Number(r.price),
                ...(isAdmin ? { cost: Number(r.cost) } : {}),
            };
        });

        return NextResponse.json({
            items,
            total: items.length,
            page: 1,
            perPage: items.length || perPage,
            totalPages: 1,
        });
    }

    const [countResult, warehouses] = await Promise.all([
        prisma.$queryRaw<[{ total: number }]>`
            SELECT COUNT(*)::int AS total
            FROM "ProductStock" ps
            JOIN "Product" p ON p."id" = ps."productId"
            JOIN "Warehouse" w ON w."id" = ps."warehouseId"
            LEFT JOIN "ProductGroup" pg ON pg."id" = p."productGroupId"
            WHERE ${whereSql}
        `,
        includeWarehouses
            ? prisma.warehouse.findMany({
                  where: { deletedAt: null, isActive: true },
                  select: { id: true, name: true },
                  orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
              })
            : Promise.resolve(undefined),
    ]);

    const total = countResult[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * perPage;

    const rows = total > 0
        ? await prisma.$queryRaw<LowStockRow[]>`
              SELECT
                  ps."id",
                  ps."productId",
                  ps."warehouseId",
                  ps."quantity"::float8 AS "quantity",
                  p."code",
                  p."barcode",
                  p."name",
                  p."brand",
                  p."unit",
                  p."minStock"::float8 AS "minStock",
                  p."price"::float8 AS "price",
                  p."cost"::float8 AS "cost",
                  pg."name" AS "category",
                  w."name" AS "warehouseName"
              FROM "ProductStock" ps
              JOIN "Product" p ON p."id" = ps."productId"
              JOIN "Warehouse" w ON w."id" = ps."warehouseId"
              LEFT JOIN "ProductGroup" pg ON pg."id" = p."productGroupId"
              WHERE ${whereSql}
              ORDER BY ps."quantity" ASC, p."name" ASC
              LIMIT ${perPage} OFFSET ${offset}
          `
        : [];

    const items = rows.map(r => {
        const qty = roundQty(Number(r.quantity));
        const min = roundQty(Number(r.minStock));
        return {
            id: r.id,
            productId: r.productId,
            code: r.code,
            barcode: r.barcode || '',
            name: r.name,
            category: r.category || '',
            brand: r.brand || '',
            unit: r.unit,
            warehouseId: r.warehouseId,
            warehouseName: r.warehouseName,
            quantity: qty,
            minStock: min,
            shortage: roundQty(Math.max(0, min - qty)),
            price: Number(r.price),
            ...(isAdmin ? { cost: Number(r.cost) } : {}),
        };
    });

    return NextResponse.json({
        items,
        total,
        page: safePage,
        perPage,
        totalPages,
        ...(warehouses ? { warehouses } : {}),
    });
}
