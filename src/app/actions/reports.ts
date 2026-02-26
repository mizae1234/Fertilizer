'use server';

import { prisma } from '@/lib/prisma';

// Helper to build date range
function getDateRange(dateFrom?: string, dateTo?: string) {
    const filter: Record<string, unknown> = {};
    if (dateFrom) filter.gte = new Date(dateFrom);
    if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        filter.lte = to;
    }
    return Object.keys(filter).length > 0 ? filter : undefined;
}

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

// ==================== STOCK DETAIL REPORT ====================

export async function getStockDetailReport(dateFrom?: string, dateTo?: string) {
    const dateRange = getDateRange(dateFrom, dateTo);
    const saleWhere = {
        status: 'APPROVED' as const,
        deletedAt: null,
        ...(dateRange ? { createdAt: dateRange } : {}),
    };

    // Get all sale items in the date range
    const saleItems = await prisma.saleItem.findMany({
        where: { sale: saleWhere },
        select: {
            productId: true,
            warehouseId: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            product: { select: { id: true, name: true, code: true } },
        },
    });

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

    // Aggregate by product (avgCost per item for COGS from stock)
    const costMap = new Map(stocks.map(s => [`${s.productId}_${s.warehouseId}`, Number(s.avgCost)]));

    // Aggregate sales by product
    const productMap = new Map<string, {
        productId: string;
        productName: string;
        productCode: string;
        qtySold: number;
        revenue: number;
        cogs: number;
    }>();

    for (const si of saleItems) {
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
        p.qtySold += si.quantity;
        p.revenue += Number(si.totalPrice);
        const unitCost = costMap.get(`${si.productId}_${si.warehouseId}`) || 0;
        p.cogs += si.quantity * unitCost;
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

// ==================== FINANCIAL REPORTS ====================

export async function getCashFlowReport(dateFrom?: string, dateTo?: string) {
    const dateRange = getDateRange(dateFrom, dateTo);

    const sales = await prisma.sale.findMany({
        where: {
            status: 'APPROVED',
            deletedAt: null,
            ...(dateRange ? { createdAt: dateRange } : {}),
        },
        select: {
            id: true,
            totalAmount: true,
            paymentMethod: true,
            payments: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    let cashTotal = 0;
    let transferTotal = 0;
    let creditTotal = 0;

    for (const sale of sales) {
        const amount = Number(sale.totalAmount);
        if (sale.payments && typeof sale.payments === 'object' && Array.isArray(sale.payments)) {
            for (const p of sale.payments as { method: string; amount: number }[]) {
                switch (p.method) {
                    case 'CASH': cashTotal += Number(p.amount); break;
                    case 'TRANSFER': transferTotal += Number(p.amount); break;
                    case 'CREDIT': creditTotal += Number(p.amount); break;
                    default: cashTotal += Number(p.amount);
                }
            }
        } else {
            switch (sale.paymentMethod) {
                case 'CASH': cashTotal += amount; break;
                case 'TRANSFER': transferTotal += amount; break;
                case 'CREDIT': creditTotal += amount; break;
                default: cashTotal += amount;
            }
        }
    }

    // AR
    const arSales = await prisma.sale.findMany({
        where: {
            status: 'APPROVED',
            deletedAt: null,
            paymentMethod: 'CREDIT',
        },
        select: {
            id: true,
            saleNumber: true,
            totalAmount: true,
            creditDueDate: true,
            createdAt: true,
            customer: { select: { name: true } },
        },
        orderBy: { creditDueDate: 'asc' },
    });

    const now = new Date();
    const aging = { current: 0, days30: 0, days60: 0, days90Plus: 0 };
    for (const s of arSales) {
        const amt = Number(s.totalAmount);
        if (!s.creditDueDate || new Date(s.creditDueDate) > now) {
            aging.current += amt;
        } else {
            const diff = Math.floor((now.getTime() - new Date(s.creditDueDate).getTime()) / 86400000);
            if (diff <= 30) aging.days30 += amt;
            else if (diff <= 60) aging.days60 += amt;
            else aging.days90Plus += amt;
        }
    }

    // Group AR by customer
    const customerMap = new Map<string, {
        customer: string;
        totalAmount: number;
        count: number;
        items: { saleId: string; saleNumber: string; amount: number; dueDate: string | null; createdAt: string }[];
    }>();
    for (const s of arSales) {
        const customerName = s.customer?.name || 'ลูกค้าทั่วไป';
        if (!customerMap.has(customerName)) {
            customerMap.set(customerName, { customer: customerName, totalAmount: 0, count: 0, items: [] });
        }
        const group = customerMap.get(customerName)!;
        group.totalAmount += Number(s.totalAmount);
        group.count++;
        group.items.push({
            saleId: s.id,
            saleNumber: s.saleNumber,
            amount: Number(s.totalAmount),
            dueDate: s.creditDueDate?.toISOString() || null,
            createdAt: s.createdAt.toISOString(),
        });
    }
    const byCustomer = Array.from(customerMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

    return {
        cashFlow: { cash: cashTotal, transfer: transferTotal, credit: creditTotal, total: cashTotal + transferTotal + creditTotal },
        ar: {
            total: arSales.reduce((sum, s) => sum + Number(s.totalAmount), 0),
            count: arSales.length,
            aging,
            byCustomer,
        },
    };
}

export async function getPnLReport(dateFrom?: string, dateTo?: string) {
    const dateRange = getDateRange(dateFrom, dateTo);
    const saleWhere = {
        status: 'APPROVED' as const,
        deletedAt: null,
        ...(dateRange ? { createdAt: dateRange } : {}),
    };
    const expenseWhere = {
        deletedAt: null,
        ...(dateRange ? { expenseDate: dateRange } : {}),
    };

    const [revenue, expenses] = await Promise.all([
        prisma.sale.aggregate({ where: saleWhere, _sum: { totalAmount: true }, _count: true }),
        prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
    ]);

    // COGS
    const saleItems = await prisma.saleItem.findMany({
        where: { sale: saleWhere },
        select: { productId: true, warehouseId: true, quantity: true },
    });

    let cogsAmount = 0;
    if (saleItems.length > 0) {
        const productIds = [...new Set(saleItems.map(si => si.productId))];
        const warehouseIds = [...new Set(saleItems.map(si => si.warehouseId))];
        const stocks = await prisma.productStock.findMany({
            where: { productId: { in: productIds }, warehouseId: { in: warehouseIds } },
            select: { productId: true, warehouseId: true, avgCost: true },
        });
        const costMap = new Map(stocks.map(s => [`${s.productId}_${s.warehouseId}`, Number(s.avgCost)]));
        cogsAmount = saleItems.reduce((sum, si) => sum + si.quantity * (costMap.get(`${si.productId}_${si.warehouseId}`) || 0), 0);
    }

    const revenueAmount = Number(revenue._sum.totalAmount || 0);
    const expenseAmount = Number(expenses._sum.amount || 0);
    const grossProfit = revenueAmount - cogsAmount;
    const netProfit = grossProfit - expenseAmount;

    const expenseByCategory = await prisma.expense.groupBy({
        by: ['category'],
        where: expenseWhere,
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
    });

    return {
        revenue: revenueAmount,
        saleCount: revenue._count,
        cogs: cogsAmount,
        grossProfit,
        grossMargin: revenueAmount > 0 ? (grossProfit / revenueAmount) * 100 : 0,
        expenses: expenseAmount,
        expenseByCategory: expenseByCategory.map(e => ({ category: e.category, amount: Number(e._sum.amount || 0) })),
        netProfit,
        netMargin: revenueAmount > 0 ? (netProfit / revenueAmount) * 100 : 0,
    };
}

// ==================== P&L DETAIL (BY BILL & BY ITEM) ====================

export async function getPnLDetail(dateFrom?: string, dateTo?: string) {
    const dateRange = getDateRange(dateFrom, dateTo);
    const saleWhere = {
        status: 'APPROVED' as const,
        deletedAt: null,
        ...(dateRange ? { createdAt: dateRange } : {}),
    };

    // Get all sales with their items
    const sales = await prisma.sale.findMany({
        where: saleWhere,
        select: {
            id: true,
            saleNumber: true,
            totalAmount: true,
            createdAt: true,
            customer: { select: { name: true } },
            items: {
                select: {
                    productId: true,
                    warehouseId: true,
                    quantity: true,
                    unitPrice: true,
                    totalPrice: true,
                    product: { select: { name: true, code: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Get avgCost for COGS calculation
    const allProductIds = [...new Set(sales.flatMap(s => s.items.map(i => i.productId)))];
    const allWarehouseIds = [...new Set(sales.flatMap(s => s.items.map(i => i.warehouseId)))];
    const stocks = allProductIds.length > 0 ? await prisma.productStock.findMany({
        where: { productId: { in: allProductIds }, warehouseId: { in: allWarehouseIds } },
        select: { productId: true, warehouseId: true, avgCost: true },
    }) : [];
    const costMap = new Map(stocks.map(s => [`${s.productId}_${s.warehouseId}`, Number(s.avgCost)]));

    // Per-bill aggregation
    const byBill = sales.map(sale => {
        const revenue = Number(sale.totalAmount);
        let cogs = 0;
        for (const item of sale.items) {
            const unitCost = costMap.get(`${item.productId}_${item.warehouseId}`) || 0;
            cogs += item.quantity * unitCost;
        }
        const profit = revenue - cogs;
        return {
            saleNumber: sale.saleNumber,
            customer: sale.customer?.name || '-',
            createdAt: sale.createdAt.toISOString(),
            itemCount: sale.items.length,
            revenue,
            cogs,
            profit,
            margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        };
    });

    // Per-item flat rows
    const byItem = sales.flatMap(sale =>
        sale.items.map(item => {
            const unitCost = costMap.get(`${item.productId}_${item.warehouseId}`) || 0;
            const revenue = Number(item.totalPrice);
            const cogs = item.quantity * unitCost;
            const profit = revenue - cogs;
            return {
                saleNumber: sale.saleNumber,
                customer: sale.customer?.name || '-',
                createdAt: sale.createdAt.toISOString(),
                productName: item.product.name,
                productCode: item.product.code,
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
                unitCost,
                revenue,
                cogs,
                profit,
                margin: revenue > 0 ? (profit / revenue) * 100 : 0,
            };
        })
    );

    return { byBill, byItem };
}
