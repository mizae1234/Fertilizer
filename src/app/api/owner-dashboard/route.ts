import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const dateFrom = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dateTo = to ? new Date(to + 'T23:59:59') : new Date();

    // Previous period for comparison
    const periodMs = dateTo.getTime() - dateFrom.getTime();
    const prevFrom = new Date(dateFrom.getTime() - periodMs);
    const prevTo = new Date(dateFrom.getTime() - 1);

    // Batch 1: All independent queries in parallel
    const [sales, prevSales, saleItems, prevSaleItems, expenses, allProducts, recentSaleItems] = await Promise.all([
        // 1. Sales summary (current period)
        prisma.sale.findMany({
            where: {
                createdAt: { gte: dateFrom, lte: dateTo },
                status: { not: 'CANCELLED' },
                deletedAt: null,
            },
            select: { totalAmount: true, createdAt: true },
        }),
        // Previous period sales for comparison
        prisma.sale.findMany({
            where: {
                createdAt: { gte: prevFrom, lte: prevTo },
                status: { not: 'CANCELLED' },
                deletedAt: null,
            },
            select: { totalAmount: true },
        }),
        // 2. SaleItems for current period (COGS, top products)
        prisma.saleItem.findMany({
            where: {
                sale: {
                    createdAt: { gte: dateFrom, lte: dateTo },
                    status: { not: 'CANCELLED' },
                    deletedAt: null,
                },
            },
            select: { 
                id: true, productId: true, quantity: true, unitCost: true, unitPrice: true, conversionRate: true,
                sale: { select: { saleReturns: { select: { items: { select: { saleItemId: true, quantity: true } } } } } } 
            },
        }),
        prisma.saleItem.findMany({
            where: {
                sale: {
                    createdAt: { gte: prevFrom, lte: prevTo },
                    status: { not: 'CANCELLED' },
                    deletedAt: null,
                },
            },
            select: { 
                id: true, quantity: true,
                sale: { select: { saleReturns: { select: { items: { select: { saleItemId: true, quantity: true } } } } } } 
            },
        }),
        // 3. Expenses
        prisma.expense.findMany({
            where: {
                expenseDate: { gte: dateFrom, lte: dateTo },
                deletedAt: null,
            },
            select: { amount: true, category: true },
        }),
        // 4. Dead stock: high stock, low sales
        prisma.product.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                name: true,
                code: true,
                productStocks: { select: { quantity: true } },
            },
        }),
        // 5. Recent sales (30 days) for dead stock
        prisma.saleItem.findMany({
            where: {
                sale: {
                    createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
                    status: { not: 'CANCELLED' },
                    deletedAt: null,
                },
            },
            select: { 
                id: true, productId: true, quantity: true,
                sale: { select: { saleReturns: { select: { items: { select: { saleItemId: true, quantity: true } } } } } } 
            },
        }),
    ]);

    // Helper to calculate net quantity
    const getNetQuantity = (item: any) => {
        let returned = 0;
        for (const sr of item.sale.saleReturns) {
            for (const ri of sr.items) {
                if (ri.saleItemId === item.id) returned += ri.quantity;
            }
        }
        return Math.max(0, item.quantity - returned);
    };

    let totalItemsSold = 0;
    let totalCOGS = 0;
    const topProductsMap = new Map<string, { quantitySold: number, totalRevenue: number }>();

    for (const item of saleItems) {
        const netQty = getNetQuantity(item);
        if (netQty <= 0) continue;
        
        totalItemsSold += netQty;
        totalCOGS += netQty * Number(item.conversionRate ?? 1) * Number(item.unitCost);
        
        const existing = topProductsMap.get(item.productId) || { quantitySold: 0, totalRevenue: 0 };
        existing.quantitySold += netQty;
        existing.totalRevenue += netQty * Number(item.unitPrice);
        topProductsMap.set(item.productId, existing);
    }

    let prevTotalItemsSold = 0;
    for (const item of prevSaleItems) {
        prevTotalItemsSold += getNetQuantity(item);
    }

    // Compute derived values
    const totalSales = sales.reduce((s, sale) => s + Number(sale.totalAmount), 0);
    const totalBills = sales.length;
    const avgPerBill = totalBills > 0 ? totalSales / totalBills : 0;
    const prevTotalSales = prevSales.reduce((s, sale) => s + Number(sale.totalAmount), 0);
    const expensesOnly = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const totalExpenses = totalCOGS + expensesOnly;
    const netProfit = totalSales - totalExpenses;

    // Expense by category
    const expenseByCategory: Record<string, number> = {};
    expenses.forEach(e => {
        expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + Number(e.amount);
    });

    // Daily sales for chart
    const dailySalesMap: Record<string, number> = {};
    sales.forEach(s => {
        const day = s.createdAt.toISOString().split('T')[0];
        dailySalesMap[day] = (dailySalesMap[day] || 0) + Number(s.totalAmount);
    });
    const dailySales: { date: string; amount: number }[] = [];
    const d = new Date(dateFrom);
    while (d <= dateTo) {
        const key = d.toISOString().split('T')[0];
        dailySales.push({ date: key, amount: dailySalesMap[key] || 0 });
        d.setDate(d.getDate() + 1);
    }

    // Top products
    const topProductsArr = Array.from(topProductsMap.entries())
        .map(([productId, data]) => ({ productId, ...data }))
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, 10);

    const topProductIds = topProductsArr.map(p => p.productId);
    const productNames = await prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: { id: true, name: true, code: true },
    });
    const productMap = Object.fromEntries(productNames.map(p => [p.id, p]));
    const topProductsList = topProductsArr.map(p => ({
        name: productMap[p.productId]?.name || 'Unknown',
        code: productMap[p.productId]?.code || '',
        quantitySold: p.quantitySold,
        totalRevenue: p.totalRevenue,
    }));

    // Dead stock
    const recentSalesMap = new Map<string, number>();
    for (const item of recentSaleItems) {
        const netQty = getNetQuantity(item);
        if (netQty > 0) {
            recentSalesMap.set(item.productId, (recentSalesMap.get(item.productId) || 0) + netQty);
        }
    }

    const deadStock = allProducts
        .map(p => ({
            name: p.name,
            code: p.code,
            totalStock: p.productStocks.reduce((s, ps) => s + ps.quantity, 0),
            soldLast30: recentSalesMap.get(p.id) || 0,
        }))
        .filter(p => p.totalStock > 0)
        .sort((a, b) => b.totalStock - a.totalStock - (b.soldLast30 - a.soldLast30))
        .slice(0, 10);

    return NextResponse.json({
        summary: {
            totalSales,
            prevTotalSales,
            netProfit,
            totalExpenses,
            totalCOGS,
            expensesOnly,
            totalItemsSold,
            prevTotalItemsSold,
            totalBills,
            avgPerBill,
        },
        dailySales,
        expenseByCategory,
        topProducts: topProductsList,
        deadStock,
    });
}
