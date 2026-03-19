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
    const [sales, prevSales, saleItems, prevSaleItems, expenses, topProducts, allProducts, recentSales] = await Promise.all([
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
        // 2. Total items sold + COGS calculation
        prisma.saleItem.findMany({
            where: {
                sale: {
                    createdAt: { gte: dateFrom, lte: dateTo },
                    status: { not: 'CANCELLED' },
                    deletedAt: null,
                },
            },
            select: { quantity: true, unitCost: true },
        }),
        prisma.saleItem.findMany({
            where: {
                sale: {
                    createdAt: { gte: prevFrom, lte: prevTo },
                    status: { not: 'CANCELLED' },
                    deletedAt: null,
                },
            },
            select: { quantity: true },
        }),
        // 3. Expenses
        prisma.expense.findMany({
            where: {
                expenseDate: { gte: dateFrom, lte: dateTo },
                deletedAt: null,
            },
            select: { amount: true, category: true },
        }),
        // 5. Top 10 best-selling products
        prisma.saleItem.groupBy({
            by: ['productId'],
            where: {
                sale: {
                    createdAt: { gte: dateFrom, lte: dateTo },
                    status: { not: 'CANCELLED' },
                    deletedAt: null,
                },
            },
            _sum: { quantity: true, totalPrice: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 10,
        }),
        // 6. Dead stock: high stock, low sales
        prisma.product.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                name: true,
                code: true,
                productStocks: { select: { quantity: true } },
            },
        }),
        // Get sales count per product in last 30 days
        prisma.saleItem.groupBy({
            by: ['productId'],
            where: {
                sale: {
                    createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
                    status: { not: 'CANCELLED' },
                    deletedAt: null,
                },
            },
            _sum: { quantity: true },
        }),
    ]);

    // Compute derived values
    const totalSales = sales.reduce((s, sale) => s + Number(sale.totalAmount), 0);
    const totalBills = sales.length;
    const avgPerBill = totalBills > 0 ? totalSales / totalBills : 0;
    const prevTotalSales = prevSales.reduce((s, sale) => s + Number(sale.totalAmount), 0);
    const totalItemsSold = saleItems.reduce((s, i) => s + i.quantity, 0);
    const totalCOGS = saleItems.reduce((s, i) => s + (i.quantity * Number(i.unitCost)), 0);
    const prevTotalItemsSold = prevSaleItems.reduce((s, i) => s + i.quantity, 0);
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

    // Top products name lookup
    const topProductIds = topProducts.map(p => p.productId);
    const productNames = await prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: { id: true, name: true, code: true },
    });
    const productMap = Object.fromEntries(productNames.map(p => [p.id, p]));
    const topProductsList = topProducts.map(p => ({
        name: productMap[p.productId]?.name || 'Unknown',
        code: productMap[p.productId]?.code || '',
        quantitySold: p._sum.quantity || 0,
        totalRevenue: Number(p._sum.totalPrice || 0),
    }));

    // Dead stock
    const recentSalesMap = Object.fromEntries(recentSales.map(s => [s.productId, s._sum.quantity || 0]));
    const deadStock = allProducts
        .map(p => ({
            name: p.name,
            code: p.code,
            totalStock: p.productStocks.reduce((s, ps) => s + ps.quantity, 0),
            soldLast30: recentSalesMap[p.id] || 0,
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
