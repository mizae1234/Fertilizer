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

export async function addInterest(
    saleId: string,
    percentage: number,
    months: number = 1,
    days: number = 0,
    note?: string
) {
    const detail = await getDebtSummary(saleId);
    if (!detail) throw new Error('ไม่พบบิล');

    const baseAmount = detail.remaining;
    if (baseAmount <= 0) throw new Error('ไม่มียอดค้างชำระ');

    const timeMultiplier = months + (days / 30);
    const calculatedPercentage = percentage * timeMultiplier;
    const amount = Math.round(baseAmount * calculatedPercentage / 100 * 100) / 100;

    const timeLabel = days > 0 
        ? `${months} เดือน ${days} วัน` 
        : `${months} เดือน`;

    await prisma.debtInterest.create({
        data: {
            saleId,
            percentage,
            baseAmount,
            amount,
            note: note || `ดอกเบี้ย ${percentage}% ต่อเดือน สำหรับเวลา ${timeLabel} (รวม ${calculatedPercentage.toFixed(2)}%) ของยอดค้าง ${baseAmount.toFixed(2)}`,
        },
    });

    revalidatePath(`/overdue-bills/${saleId}`);
    return { amount };
}

export async function deleteInterest(interestId: string, saleId: string) {
    await prisma.$transaction(async (tx) => {
        await tx.debtInterest.delete({
            where: { id: interestId }
        });

        const [sale, debtPayments, debtInterests] = await Promise.all([
            tx.sale.findUnique({
                where: { id: saleId },
                select: { id: true, totalAmount: true, payments: true, paymentMethod: true, creditDueDate: true },
            }),
            tx.debtPayment.findMany({ where: { saleId } }),
            tx.debtInterest.findMany({ where: { saleId } }),
        ]);
        if (!sale) throw new Error('ไม่พบบิล');

        const detail = computeDebtTotals({ ...sale, debtPayments, debtInterests });
        
        if (detail.isPaidOff && sale.paymentMethod !== 'PAID') {
            await tx.sale.update({
                where: { id: saleId },
                data: { paymentMethod: 'PAID' },
            });
        } else if (!detail.isPaidOff && sale.paymentMethod === 'PAID') {
            let hasInitialNonCredit = false;
            if (sale.payments && Array.isArray(sale.payments)) {
                hasInitialNonCredit = (sale.payments as any[]).some(p => p.method !== 'CREDIT');
            }
            await tx.sale.update({
                where: { id: saleId },
                data: { paymentMethod: hasInitialNonCredit ? 'SPLIT' : 'CREDIT' },
            });
        }
    });

    revalidatePath(`/overdue-bills/${saleId}`);
    revalidatePath('/overdue-bills');
    return { success: true };
}

export async function payDebt(
    saleId: string,
    payments: { method: string; amount: number; dueDate?: string }[]
) {
    const isPaidOff = await prisma.$transaction(async (tx) => {
        // Validate inside transaction to prevent race conditions
        const [sale, debtPayments, debtInterests] = await Promise.all([
            tx.sale.findUnique({
                where: { id: saleId },
                select: { id: true, totalAmount: true, payments: true, paymentMethod: true, creditDueDate: true },
            }),
            tx.debtPayment.findMany({ where: { saleId } }),
            tx.debtInterest.findMany({ where: { saleId } }),
        ]);
        if (!sale) throw new Error('ไม่พบบิล');

        const detail = computeDebtTotals({ ...sale, debtPayments, debtInterests });
        if (detail.isPaidOff) throw new Error('บิลนี้ชำระครบแล้ว');

        // Create all payment records
        await Promise.all(payments.map(p =>
            tx.debtPayment.create({
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
            await tx.sale.update({
                where: { id: saleId },
                data: { creditDueDate: new Date(creditPayment.dueDate) },
            });
        }

        // Check if fully paid now
        const updatedPayments = await tx.debtPayment.findMany({ where: { saleId } });
        const updatedInterests = await tx.debtInterest.findMany({ where: { saleId } });
        const updated = computeDebtTotals({ ...sale, debtPayments: updatedPayments, debtInterests: updatedInterests });
        if (updated.isPaidOff) {
            await tx.sale.update({
                where: { id: saleId },
                data: { paymentMethod: 'PAID' },
            });
        }
        return updated.isPaidOff;
    });

    revalidatePath(`/overdue-bills/${saleId}`);
    revalidatePath('/overdue-bills');
    return { success: true, isPaidOff };
}
