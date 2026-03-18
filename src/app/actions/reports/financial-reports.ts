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

    // AR — include debtPayments to calculate paid & remaining
    // Match overdue-bills logic: include CREDIT + SPLIT payment methods
    const arSales = await prisma.sale.findMany({
        where: {
            status: 'APPROVED',
            deletedAt: null,
            paymentMethod: { in: ['CREDIT', 'SPLIT'] },
        },
        select: {
            id: true,
            saleNumber: true,
            totalAmount: true,
            creditDueDate: true,
            createdAt: true,
            customer: { select: { name: true } },
            payments: true,
            debtPayments: {
                select: { amount: true, method: true },
            },
            debtInterests: {
                select: { amount: true },
            },
        },
        orderBy: { creditDueDate: 'asc' },
    });

    const now = new Date();
    const aging = { current: 0, days30: 0, days60: 0, days90Plus: 0 };

    // Group AR by customer — with paid/remaining calculation
    // Uses same logic as overdue-bills page (getPaymentSplit)
    const customerMap = new Map<string, {
        customer: string;
        totalAmount: number;
        totalPaid: number;
        totalRemaining: number;
        count: number;
        items: { saleId: string; saleNumber: string; amount: number; paidAmount: number; remainingAmount: number; dueDate: string | null; createdAt: string }[];
    }>();

    for (const s of arSales) {
        const totalAmount = Number(s.totalAmount);
        const totalInterest = s.debtInterests.reduce((sum, di) => sum + Number(di.amount), 0);
        const grandTotal = totalAmount + totalInterest;

        // Initial paid from POS (non-credit payments in the payments JSON)
        let initialPaid = 0;
        if (s.payments && typeof s.payments === 'object' && Array.isArray(s.payments)) {
            for (const p of s.payments as { method: string; amount: number }[]) {
                if (p.method !== 'CREDIT') {
                    initialPaid += Number(p.amount);
                }
            }
        }

        // Subsequent debt payments (only non-credit method — actual cash/transfer payments)
        const debtPaid = s.debtPayments
            .filter(dp => dp.method !== 'CREDIT')
            .reduce((sum, dp) => sum + Number(dp.amount), 0);

        const paidAmount = initialPaid + debtPaid;
        const remaining = grandTotal - paidAmount;

        // Skip fully paid bills
        if (remaining <= 0) continue;

        // Aging based on remaining amount
        if (!s.creditDueDate || new Date(s.creditDueDate) > now) {
            aging.current += remaining;
        } else {
            const diff = Math.floor((now.getTime() - new Date(s.creditDueDate).getTime()) / 86400000);
            if (diff <= 30) aging.days30 += remaining;
            else if (diff <= 60) aging.days60 += remaining;
            else aging.days90Plus += remaining;
        }

        const customerName = s.customer?.name || 'ลูกค้าทั่วไป';
        if (!customerMap.has(customerName)) {
            customerMap.set(customerName, { customer: customerName, totalAmount: 0, totalPaid: 0, totalRemaining: 0, count: 0, items: [] });
        }
        const group = customerMap.get(customerName)!;
        group.totalAmount += totalAmount;
        group.totalPaid += paidAmount;
        group.totalRemaining += remaining;
        group.count++;
        group.items.push({
            saleId: s.id,
            saleNumber: s.saleNumber,
            amount: totalAmount,
            paidAmount,
            remainingAmount: remaining,
            dueDate: s.creditDueDate?.toISOString() || null,
            createdAt: s.createdAt.toISOString(),
        });
    }
    const byCustomer = Array.from(customerMap.values()).sort((a, b) => b.totalRemaining - a.totalRemaining);
    const arTotal = byCustomer.reduce((sum, c) => sum + c.totalRemaining, 0);
    const arCount = byCustomer.reduce((sum, c) => sum + c.count, 0);

    return {
        cashFlow: { cash: cashTotal, transfer: transferTotal, credit: creditTotal, total: cashTotal + transferTotal + creditTotal },
        ar: {
            total: arTotal,
            count: arCount,
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

    const factoryReturnWhere = {
        status: 'APPROVED' as const,
        deletedAt: null,
        ...(dateRange ? { createdAt: dateRange } : {}),
    };

    const [revenue, expenses, factoryReturns] = await Promise.all([
        prisma.sale.aggregate({ where: saleWhere, _sum: { totalAmount: true }, _count: true }),
        prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
        prisma.factoryReturn.aggregate({ where: factoryReturnWhere, _sum: { totalAmount: true } }),
    ]);

    // COGS — use SaleItem.unitCost (cost at time of sale), account for returns
    const saleItems = await prisma.saleItem.findMany({
        where: { sale: saleWhere },
        select: {
            id: true, productId: true, warehouseId: true, quantity: true,
            conversionRate: true,
            unitCost: true,
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

    let cogsAmount = 0;
    if (saleItems.length > 0) {
        cogsAmount = saleItems.reduce((sum, si) => {
            const returned = retMap.get(si.id) || 0;
            const remaining = si.quantity - returned;
            const rate = Number(si.conversionRate ?? 1);
            const unitCost = Number(si.unitCost);
            return sum + Math.max(0, remaining) * rate * unitCost;
        }, 0);
    }

    const revenueAmount = Number(revenue._sum.totalAmount || 0);
    const expenseAmount = Number(expenses._sum.amount || 0);
    const factoryReturnAmount = Number(factoryReturns._sum.totalAmount || 0);
    const grossProfit = revenueAmount - cogsAmount - factoryReturnAmount;
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
        factoryReturnCost: factoryReturnAmount,
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

    // Get all sales with their items and return data
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
                    id: true,
                    productId: true,
                    warehouseId: true,
                    quantity: true,
                    unitPrice: true,
                    unitCost: true,
                    totalPrice: true,
                    conversionRate: true,
                    product: { select: { name: true, code: true } },
                },
            },
            saleReturns: {
                select: { items: { select: { saleItemId: true, quantity: true } } },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Per-bill aggregation
    const byBill = sales.map(sale => {
        // Build return map for this sale
        const retMap = new Map<string, number>();
        for (const sr of sale.saleReturns) {
            for (const ri of sr.items) {
                retMap.set(ri.saleItemId, (retMap.get(ri.saleItemId) || 0) + ri.quantity);
            }
        }

        const revenue = Number(sale.totalAmount);
        let cogs = 0;
        for (const item of sale.items) {
            const returned = retMap.get(item.id) || 0;
            const remaining = item.quantity - returned;
            if (remaining <= 0) continue;
            const unitCost = Number(item.unitCost);
            const rate = Number(item.conversionRate ?? 1);
            cogs += remaining * rate * unitCost;
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

    // Per-item flat rows (exclude fully returned)
    const byItem = sales.flatMap(sale => {
        const retMap = new Map<string, number>();
        for (const sr of sale.saleReturns) {
            for (const ri of sr.items) {
                retMap.set(ri.saleItemId, (retMap.get(ri.saleItemId) || 0) + ri.quantity);
            }
        }

        return sale.items
            .map(item => {
                const returned = retMap.get(item.id) || 0;
                const remaining = item.quantity - returned;
                if (remaining <= 0) return null;
                const unitCost = Number(item.unitCost);
                const rate = Number(item.conversionRate ?? 1);
                const revenue = remaining * Number(item.unitPrice);
                const cogs = remaining * rate * unitCost;
                const profit = revenue - cogs;
                return {
                    saleNumber: sale.saleNumber,
                    customer: sale.customer?.name || '-',
                    createdAt: sale.createdAt.toISOString(),
                    productName: item.product.name,
                    productCode: item.product.code,
                    quantity: remaining,
                    unitPrice: Number(item.unitPrice),
                    unitCost,
                    revenue,
                    cogs,
                    profit,
                    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
                };
            })
            .filter(Boolean) as {
                saleNumber: string; customer: string; createdAt: string;
                productName: string; productCode: string; quantity: number;
                unitPrice: number; unitCost: number; revenue: number;
                cogs: number; profit: number; margin: number;
            }[];
    });

    return { byBill, byItem };
}
