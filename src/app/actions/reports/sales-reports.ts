'use server';

import { prisma } from '@/lib/prisma';
import { getDateRange } from './utils';

// ==================== SALES REPORTS ====================

export async function getSalesOverview(dateFrom?: string, dateTo?: string) {
    const dateRange = getDateRange(dateFrom, dateTo);

    const where = {
        status: 'APPROVED' as const,
        deletedAt: null,
        ...(dateRange ? { createdAt: dateRange } : {}),
    };

    const [totalSales, salesByWarehouse, dailySales] = await Promise.all([
        prisma.sale.aggregate({
            where,
            _sum: { totalAmount: true },
            _count: true,
        }),

        prisma.saleItem.groupBy({
            by: ['warehouseId'],
            where: { sale: where },
            _sum: { totalPrice: true },
            _count: true,
        }),

        prisma.$queryRawUnsafe<{ date: string; total: number; count: number }[]>(`
            SELECT 
                DATE("createdAt") as date,
                SUM("totalAmount"::numeric) as total,
                COUNT(*)::int as count
            FROM "Sale"
            WHERE status = 'APPROVED' 
                AND "deletedAt" IS NULL
                ${dateFrom ? `AND "createdAt" >= '${new Date(dateFrom).toISOString()}'` : ''}
                ${dateTo ? `AND "createdAt" <= '${new Date(new Date(dateTo).setHours(23, 59, 59, 999)).toISOString()}'` : ''}
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
        `),
    ]);

    const warehouseIds = salesByWarehouse.map(s => s.warehouseId);
    const warehouses = warehouseIds.length > 0
        ? await prisma.warehouse.findMany({
            where: { id: { in: warehouseIds } },
            select: { id: true, name: true },
        })
        : [];
    const warehouseMap = new Map(warehouses.map(w => [w.id, w.name]));

    return {
        totalAmount: Number(totalSales._sum.totalAmount || 0),
        totalCount: totalSales._count || 0,
        byWarehouse: salesByWarehouse.map(s => ({
            warehouseId: s.warehouseId,
            warehouseName: warehouseMap.get(s.warehouseId) || 'ไม่ระบุ',
            totalAmount: Number(s._sum.totalPrice || 0),
            count: s._count,
        })),
        dailySales: dailySales.map(d => ({
            date: new Date(d.date).toISOString().split('T')[0],
            total: Number(d.total),
            count: Number(d.count),
        })),
    };
}

export async function getSalesDetail(dateFrom?: string, dateTo?: string) {
    const dateRange = getDateRange(dateFrom, dateTo);
    const sales = await prisma.sale.findMany({
        where: {
            status: 'APPROVED',
            deletedAt: null,
            ...(dateRange ? { createdAt: dateRange } : {}),
        },
        select: {
            id: true,
            saleNumber: true,
            totalAmount: true,
            paymentMethod: true,
            createdAt: true,
            customer: { select: { name: true } },
            items: {
                select: {
                    id: true,
                    quantity: true,
                    unitPrice: true,
                    totalPrice: true,
                    product: { select: { name: true, code: true } },
                    warehouse: { select: { name: true } },
                },
            },
            saleReturns: {
                select: { items: { select: { saleItemId: true, quantity: true } } },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
    });

    return sales.map(s => {
        // Build returned quantity map
        const retMap = new Map<string, number>();
        for (const sr of s.saleReturns) {
            for (const ri of sr.items) {
                retMap.set(ri.saleItemId, (retMap.get(ri.saleItemId) || 0) + ri.quantity);
            }
        }
        // Adjust items and filter out fully returned
        const adjustedItems = s.items
            .map(i => {
                const returned = retMap.get(i.id) || 0;
                const remaining = i.quantity - returned;
                return {
                    productName: i.product.name,
                    productCode: i.product.code,
                    warehouse: i.warehouse.name,
                    quantity: remaining,
                    unitPrice: Number(i.unitPrice),
                    totalPrice: remaining * Number(i.unitPrice),
                };
            })
            .filter(i => i.quantity > 0);

        return {
            id: s.id,
            saleNumber: s.saleNumber,
            customer: s.customer?.name || 'ลูกค้าทั่วไป',
            totalAmount: Number(s.totalAmount),
            paymentMethod: s.paymentMethod,
            createdAt: s.createdAt.toISOString(),
            items: adjustedItems,
        };
    });
}

export async function getTopProducts(dateFrom?: string, dateTo?: string) {
    const dateRange = getDateRange(dateFrom, dateTo);
    const saleWhere = {
        status: 'APPROVED' as const,
        deletedAt: null,
        ...(dateRange ? { createdAt: dateRange } : {}),
    };

    // Get all sale items with their return data
    const allSaleItems = await prisma.saleItem.findMany({
        where: { sale: saleWhere },
        select: {
            id: true,
            productId: true,
            quantity: true,
            totalPrice: true,
            unitPrice: true,
            product: {
                select: {
                    id: true, name: true, code: true,
                    productGroup: { select: { name: true } },
                },
            },
            sale: {
                select: {
                    saleReturns: {
                        select: { items: { select: { saleItemId: true, quantity: true } } },
                    },
                },
            },
        },
    });

    // Build global return map
    const retMap = new Map<string, number>();
    for (const si of allSaleItems) {
        for (const sr of si.sale.saleReturns) {
            for (const ri of sr.items) {
                if (!retMap.has(ri.saleItemId)) retMap.set(ri.saleItemId, 0);
                retMap.set(ri.saleItemId, retMap.get(ri.saleItemId)! + ri.quantity);
            }
        }
    }

    // Aggregate by product with returns deducted
    const productAgg = new Map<string, {
        productId: string; name: string; code: string; group: string;
        quantity: number; totalAmount: number; orderIds: Set<string>;
    }>();
    const categoryMap = new Map<string, { total: number; count: number }>();
    const productIdsWithSales = new Set<string>();

    for (const si of allSaleItems) {
        const returned = retMap.get(si.id) || 0;
        const remaining = si.quantity - returned;
        if (remaining <= 0) continue;

        productIdsWithSales.add(si.productId);
        const adjustedTotal = remaining * Number(si.unitPrice);

        if (!productAgg.has(si.productId)) {
            productAgg.set(si.productId, {
                productId: si.productId,
                name: si.product.name,
                code: si.product.code,
                group: si.product.productGroup?.name || '-',
                quantity: 0, totalAmount: 0, orderIds: new Set(),
            });
        }
        const p = productAgg.get(si.productId)!;
        p.quantity += remaining;
        p.totalAmount += adjustedTotal;

        // Category aggregation
        const cat = si.product.productGroup?.name || 'ไม่มีหมวดหมู่';
        const existing = categoryMap.get(cat) || { total: 0, count: 0 };
        existing.total += adjustedTotal;
        existing.count += remaining;
        categoryMap.set(cat, existing);
    }

    const topProducts = Array.from(productAgg.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 20)
        .map(p => ({
            productId: p.productId,
            name: p.name,
            code: p.code,
            group: p.group,
            quantity: p.quantity,
            totalAmount: p.totalAmount,
            orderCount: 0, // simplified
        }));

    const allProducts = await prisma.product.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true, code: true },
    });

    const slowMovers = allProducts
        .filter(p => !productIdsWithSales.has(p.id))
        .slice(0, 10);

    const byCategory = Array.from(categoryMap.entries())
        .map(([category, data]) => ({ category, totalAmount: data.total, quantity: data.count }))
        .sort((a, b) => b.totalAmount - a.totalAmount);

    return {
        topProducts,
        slowMovers,
        byCategory,
    };
}

export async function getCustomerReport(dateFrom?: string, dateTo?: string) {
    const dateRange = getDateRange(dateFrom, dateTo);
    const saleWhere = {
        status: 'APPROVED' as const,
        deletedAt: null,
        ...(dateRange ? { createdAt: dateRange } : {}),
    };

    const customers = await prisma.customer.findMany({
        where: { deletedAt: null },
        select: {
            id: true,
            name: true,
            phone: true,
            totalPoints: true,
            customerGroup: { select: { name: true } },
            sales: {
                where: saleWhere,
                select: { totalAmount: true },
            },
        },
        orderBy: { name: 'asc' },
    });

    return customers
        .map(c => {
            const totalAmount = c.sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
            return {
                id: c.id,
                name: c.name,
                phone: c.phone,
                group: c.customerGroup?.name || '-',
                totalPoints: c.totalPoints,
                orderCount: c.sales.length,
                totalAmount,
                avgAmount: c.sales.length > 0 ? totalAmount / c.sales.length : 0,
            };
        })
        .filter(c => c.orderCount > 0)
        .sort((a, b) => b.totalAmount - a.totalAmount);
}
