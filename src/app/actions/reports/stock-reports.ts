'use server';

import { prisma } from '@/lib/prisma';
import { getDateRange } from './utils';

// ==================== STOCK DETAIL REPORT ====================

export async function getStockDetailReport(dateFrom?: string, dateTo?: string) {
    const dateRange = getDateRange(dateFrom, dateTo);
    const saleWhere = {
        status: 'APPROVED' as const,
        deletedAt: null,
        ...(dateRange ? { createdAt: dateRange } : {}),
    };

    // Get all sale items in the date range with return data
    const saleItems = await prisma.saleItem.findMany({
        where: { sale: saleWhere },
        select: {
            id: true,
            productId: true,
            warehouseId: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            product: { select: { id: true, name: true, code: true } },
            sale: {
                select: {
                    saleReturns: {
                        select: { items: { select: { saleItemId: true, quantity: true } } },
                    },
                },
            },
        },
    });

    // Build return map
    const retMap = new Map<string, number>();
    for (const si of saleItems) {
        for (const sr of si.sale.saleReturns) {
            for (const ri of sr.items) {
                retMap.set(ri.saleItemId, (retMap.get(ri.saleItemId) || 0) + ri.quantity);
            }
        }
    }

    // Get current stock for all products
    const stocks = await prisma.productStock.findMany({
        select: {
            productId: true,
            warehouseId: true,
            quantity: true,
            avgCost: true,
            warehouse: { select: { name: true } },
        },
    });
    const stockMap = new Map(stocks.map(s => [`${s.productId}`, { quantity: s.quantity, avgCost: Number(s.avgCost), warehouse: s.warehouse.name }]));
    // Aggregate by productId for total stock across warehouses
    const totalStockMap = new Map<string, { totalQty: number; totalAvgCost: number; count: number }>();
    for (const s of stocks) {
        const existing = totalStockMap.get(s.productId);
        if (existing) {
            existing.totalQty += s.quantity;
            existing.totalAvgCost += Number(s.avgCost);
            existing.count++;
        } else {
            totalStockMap.set(s.productId, { totalQty: s.quantity, totalAvgCost: Number(s.avgCost), count: 1 });
        }
    }

    // Aggregate avgCost per item for COGS from stock
    const costMap = new Map(stocks.map(s => [`${s.productId}_${s.warehouseId}`, Number(s.avgCost)]));

    // Aggregate sales by product with returns deducted
    const productMap = new Map<string, {
        productId: string;
        productName: string;
        productCode: string;
        qtySold: number;
        revenue: number;
        cogs: number;
    }>();

    for (const si of saleItems) {
        const returned = retMap.get(si.id) || 0;
        const remaining = si.quantity - returned;
        if (remaining <= 0) continue;

        const key = si.productId;
        if (!productMap.has(key)) {
            productMap.set(key, {
                productId: si.productId,
                productName: si.product.name,
                productCode: si.product.code,
                qtySold: 0,
                revenue: 0,
                cogs: 0,
            });
        }
        const p = productMap.get(key)!;
        p.qtySold += remaining;
        p.revenue += remaining * Number(si.unitPrice);
        const unitCost = costMap.get(`${si.productId}_${si.warehouseId}`) || 0;
        p.cogs += remaining * unitCost;
    }

    // Build result with stock info
    const result = Array.from(productMap.values()).map(p => {
        const stockInfo = totalStockMap.get(p.productId);
        const stockRemaining = stockInfo?.totalQty ?? 0;
        const profit = p.revenue - p.cogs;
        return {
            productName: p.productName,
            productCode: p.productCode,
            qtySold: p.qtySold,
            revenue: p.revenue,
            cogs: p.cogs,
            profit,
            margin: p.revenue > 0 ? (profit / p.revenue) * 100 : 0,
            stockRemaining,
        };
    }).sort((a, b) => b.revenue - a.revenue);

    return result;
}

// ==================== INVENTORY REPORTS ====================

export async function getInventoryReport() {
    const [stocks, lowStockCount] = await Promise.all([
        prisma.productStock.findMany({
            include: {
                product: { select: { id: true, name: true, code: true, minStock: true, cost: true } },
                warehouse: { select: { id: true, name: true } },
            },
            orderBy: [{ warehouse: { name: 'asc' } }, { product: { name: 'asc' } }],
        }),
        prisma.productStock.count({
            where: { quantity: { lt: 10 } },
        }),
    ]);

    const byWarehouse = new Map<string, {
        warehouseId: string;
        warehouseName: string;
        totalQuantity: number;
        totalValue: number;
        lowStockItems: number;
    }>();

    for (const stock of stocks) {
        const key = stock.warehouseId;
        if (!byWarehouse.has(key)) {
            byWarehouse.set(key, {
                warehouseId: stock.warehouseId,
                warehouseName: stock.warehouse.name,
                totalQuantity: 0,
                totalValue: 0,
                lowStockItems: 0,
            });
        }
        const wh = byWarehouse.get(key)!;
        wh.totalQuantity += stock.quantity;
        wh.totalValue += stock.quantity * Number(stock.avgCost);
        if (stock.quantity < stock.product.minStock) {
            wh.lowStockItems++;
        }
    }

    const lowStockAlerts = stocks
        .filter(s => s.quantity < s.product.minStock)
        .map(s => ({
            productId: s.product.id,
            productName: s.product.name,
            code: s.product.code,
            warehouse: s.warehouse.name,
            quantity: s.quantity,
            minStock: s.product.minStock,
        }));

    const totalValue = stocks.reduce((sum, s) => sum + s.quantity * Number(s.avgCost), 0);

    return {
        totalValue,
        lowStockCount,
        byWarehouse: Array.from(byWarehouse.values()),
        lowStockAlerts,
        allStocks: stocks.map(s => ({
            productName: s.product.name,
            code: s.product.code,
            warehouse: s.warehouse.name,
            quantity: s.quantity,
            avgCost: Number(s.avgCost),
            value: s.quantity * Number(s.avgCost),
        })),
    };
}
