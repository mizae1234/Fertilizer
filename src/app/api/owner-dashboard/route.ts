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

    // 1. Sales summary (current period)
    const sales = await prisma.sale.findMany({
        where: {
            createdAt: { gte: dateFrom, lte: dateTo },
            status: { not: 'CANCELLED' },
            deletedAt: null,
        },
        select: { totalAmount: true, createdAt: true },
    });

    const totalSales = sales.reduce((s, sale) => s + Number(sale.totalAmount), 0);
    const totalBills = sales.length;
    const avgPerBill = totalBills > 0 ? totalSales / totalBills : 0;

    // Previous period sales for comparison
    const prevSales = await prisma.sale.findMany({
        where: {
            createdAt: { gte: prevFrom, lte: prevTo },
            status: { not: 'CANCELLED' },
            deletedAt: null,
        },
        select: { totalAmount: true },
    });
    const prevTotalSales = prevSales.reduce((s, sale) => s + Number(sale.totalAmount), 0);

    // 2. Total items sold
    const saleItems = await prisma.saleItem.findMany({
        where: {
            sale: {
                createdAt: { gte: dateFrom, lte: dateTo },
                status: { not: 'CANCELLED' },
                deletedAt: null,
            },
        },
        select: { quantity: true },
    });
    const totalItemsSold = saleItems.reduce((s, i) => s + i.quantity, 0);
    const prevSaleItems = await prisma.saleItem.findMany({
        where: {
            sale: {
                createdAt: { gte: prevFrom, lte: prevTo },
                status: { not: 'CANCELLED' },
                deletedAt: null,
            },
        },
        select: { quantity: true },
    });
    const prevTotalItemsSold = prevSaleItems.reduce((s, i) => s + i.quantity, 0);

    // 3. Expenses
    const expenses = await prisma.expense.findMany({
        where: {
            expenseDate: { gte: dateFrom, lte: dateTo },
            deletedAt: null,
        },
        select: { amount: true, category: true },
    });
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const netProfit = totalSales - totalExpenses;

    // Expense by category
    const expenseByCategory: Record<string, number> = {};
    expenses.forEach(e => {
        expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + Number(e.amount);
    });

    // 4. Daily sales for chart
    const dailySalesMap: Record<string, number> = {};
    sales.forEach(s => {
        const day = s.createdAt.toISOString().split('T')[0];
        dailySalesMap[day] = (dailySalesMap[day] || 0) + Number(s.totalAmount);
    });
    // Fill in missing days
    const dailySales: { date: string; amount: number }[] = [];
    const d = new Date(dateFrom);
    while (d <= dateTo) {
        const key = d.toISOString().split('T')[0];
        dailySales.push({ date: key, amount: dailySalesMap[key] || 0 });
        d.setDate(d.getDate() + 1);
    }

    // 5. Top 10 best-selling products
    const topProducts = await prisma.saleItem.groupBy({
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
    });

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

    // 6. Dead stock: high stock, low sales
    const allProducts = await prisma.product.findMany({
        where: { deletedAt: null },
        select: {
            id: true,
            name: true,
            code: true,
            productStocks: { select: { quantity: true } },
        },
    });

    // Get sales count per product in last 30 days
    const recentSales = await prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
            sale: {
                createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
                status: { not: 'CANCELLED' },
                deletedAt: null,
            },
        },
        _sum: { quantity: true },
    });
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
