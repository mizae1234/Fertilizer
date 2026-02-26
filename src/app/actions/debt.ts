'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getDebtDetail(saleId: string) {
    const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
            customer: { select: { id: true, name: true, phone: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true } },
                    warehouse: { select: { name: true } },
                },
            },
            debtPayments: { orderBy: { paidAt: 'desc' } },
            debtInterests: { orderBy: { createdAt: 'desc' } },
        },
    });
    if (!sale) return null;

    return computeDebtTotals(sale);
}

// Lightweight version — only fetches amounts, no items/relations
async function getDebtSummary(saleId: string) {
    const [sale, debtPayments, debtInterests] = await Promise.all([
        prisma.sale.findUnique({
            where: { id: saleId },
            select: { id: true, totalAmount: true, payments: true, paymentMethod: true, creditDueDate: true },
        }),
        prisma.debtPayment.findMany({ where: { saleId } }),
        prisma.debtInterest.findMany({ where: { saleId } }),
    ]);
    if (!sale) return null;

    return computeDebtTotals({ ...sale, debtPayments, debtInterests });
}

function computeDebtTotals<T extends {
    totalAmount: unknown;
    payments: unknown;
    creditDueDate: Date | null;
    debtPayments: { method: string; amount: unknown; dueDate: Date | null; paidAt: Date }[];
    debtInterests: { amount: unknown }[];
}>(sale: T) {
    const totalBill = Number(sale.totalAmount);
    const totalInterest = sale.debtInterests.reduce((s, di) => s + Number(di.amount), 0);
    const grandTotal = totalBill + totalInterest;

    // Initial payment at time of sale (non-credit portion)
    let initialPaid = 0;
    if (sale.payments && Array.isArray(sale.payments)) {
        for (const p of sale.payments as { method: string; amount: number }[]) {
            if (p.method !== 'CREDIT') {
                initialPaid += Number(p.amount);
            }
        }
    }

    // Subsequent debt payments
    const debtPaid = sale.debtPayments
        .filter(dp => dp.method !== 'CREDIT')
        .reduce((s, dp) => s + Number(dp.amount), 0);

    const totalPaid = initialPaid + debtPaid;
    const remaining = grandTotal - totalPaid;

    // Check current due date (latest credit payment or original)
    const latestCreditPayment = sale.debtPayments
        .filter(dp => dp.method === 'CREDIT' && dp.dueDate)
        .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0];
    const currentDueDate = latestCreditPayment?.dueDate || sale.creditDueDate;

    return {
        ...sale,
        totalAmount: totalBill,
        totalInterest,
        grandTotal,
        initialPaid,
        debtPaid,
        totalPaid,
        remaining: remaining > 0 ? remaining : 0,
        currentDueDate,
        isPaidOff: remaining <= 0.01,
    };
}

export async function addInterest(saleId: string, percentage: number, note?: string) {
    const detail = await getDebtSummary(saleId);
    if (!detail) throw new Error('ไม่พบบิล');

    const baseAmount = detail.remaining;
    if (baseAmount <= 0) throw new Error('ไม่มียอดค้างชำระ');

    const amount = Math.round(baseAmount * percentage / 100 * 100) / 100;

    await prisma.debtInterest.create({
        data: {
            saleId,
            percentage,
            baseAmount,
            amount,
            note: note || `ดอกเบี้ย ${percentage}% ของยอดค้าง ${baseAmount.toFixed(2)}`,
        },
    });

    revalidatePath(`/overdue-bills/${saleId}`);
    return { amount };
}

export async function payDebt(
    saleId: string,
    payments: { method: string; amount: number; dueDate?: string }[]
) {
    const detail = await getDebtSummary(saleId);
    if (!detail) throw new Error('ไม่พบบิล');
    if (detail.isPaidOff) throw new Error('บิลนี้ชำระครบแล้ว');

    // Create all payment records in parallel
    await Promise.all(payments.map(p =>
        prisma.debtPayment.create({
            data: {
                saleId,
                amount: p.amount,
                method: p.method,
                dueDate: p.dueDate ? new Date(p.dueDate) : null,
                note: p.method === 'CREDIT' && p.dueDate
                    ? `เลื่อนกำหนดชำระไปวันที่ ${p.dueDate}`
                    : null,
            },
        })
    ));

    // If CREDIT payment exists, update sale due date
    const creditPayment = payments.find(p => p.method === 'CREDIT' && p.dueDate);
    if (creditPayment?.dueDate) {
        await prisma.sale.update({
            where: { id: saleId },
            data: { creditDueDate: new Date(creditPayment.dueDate) },
        });
    }

    // Check if fully paid now — use lightweight summary
    const updated = await getDebtSummary(saleId);
    if (updated && updated.isPaidOff) {
        await prisma.sale.update({
            where: { id: saleId },
            data: { paymentMethod: 'PAID' },
        });
    }

    revalidatePath(`/overdue-bills/${saleId}`);
    revalidatePath('/overdue-bills');
    return { success: true, isPaidOff: updated?.isPaidOff || false };
}
