'use server';

import { prisma } from '@/lib/prisma';
import { getDateRange } from './utils';

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
