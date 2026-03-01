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
                    quantity: true,
                    unitPrice: true,
                    totalPrice: true,
                    product: { select: { name: true, code: true } },
                    warehouse: { select: { name: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
    });

    return sales.map(s => ({
        id: s.id,
        saleNumber: s.saleNumber,
        customer: s.customer?.name || 'ลูกค้าทั่วไป',
        totalAmount: Number(s.totalAmount),
        paymentMethod: s.paymentMethod,
        createdAt: s.createdAt.toISOString(),
        items: s.items.map(i => ({
            productName: i.product.name,
            productCode: i.product.code,
            warehouse: i.warehouse.name,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
            totalPrice: Number(i.totalPrice),
        })),
    }));
}

export async function getTopProducts(dateFrom?: string, dateTo?: string) {
    const dateRange = getDateRange(dateFrom, dateTo);
    const saleWhere = {
        status: 'APPROVED' as const,
        deletedAt: null,
        ...(dateRange ? { createdAt: dateRange } : {}),
    };

    const topProducts = await prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: saleWhere },
        _sum: { quantity: true, totalPrice: true },
        _count: true,
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 20,
    });

    const productIds = topProducts.map(p => p.productId);
    const products = productIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, code: true, productGroup: { select: { name: true } } },
        })
        : [];
    const productMap = new Map(products.map(p => [p.id, p]));

    const allProducts = await prisma.product.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true, code: true },
    });

    const productsWithSales = new Set(
        (await prisma.saleItem.findMany({
            where: { sale: saleWhere },
            select: { productId: true },
            distinct: ['productId'],
        })).map(s => s.productId)
    );

    const slowMovers = allProducts
        .filter(p => !productsWithSales.has(p.id))
        .slice(0, 10);

    // Sales by category  
    const allSaleItems = await prisma.saleItem.findMany({
        where: { sale: saleWhere },
        select: {
            totalPrice: true,
            quantity: true,
            product: {
                select: { productGroup: { select: { name: true } } },
            },
        },
    });

    const categoryMap = new Map<string, { total: number; count: number }>();
    for (const si of allSaleItems) {
        const cat = si.product.productGroup?.name || 'ไม่มีหมวดหมู่';
        const existing = categoryMap.get(cat) || { total: 0, count: 0 };
        existing.total += Number(si.totalPrice);
        existing.count += si.quantity;
        categoryMap.set(cat, existing);
    }
    const byCategory = Array.from(categoryMap.entries())
        .map(([category, data]) => ({ category, totalAmount: data.total, quantity: data.count }))
        .sort((a, b) => b.totalAmount - a.totalAmount);

    return {
        topProducts: topProducts.map(p => {
            const prod = productMap.get(p.productId);
            return {
                productId: p.productId,
                name: prod?.name || 'ไม่พบ',
                code: prod?.code || '',
                group: prod?.productGroup?.name || '-',
                quantity: p._sum.quantity || 0,
                totalAmount: Number(p._sum.totalPrice || 0),
                orderCount: p._count,
            };
        }),
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
