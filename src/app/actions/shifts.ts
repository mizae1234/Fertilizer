'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/generateNumber';

export interface ShiftSummaryData {
    totalSales: number;
    cashSales: number;
    transferSales: number;
    chequeSales: number;
    creditSales: number;
    salesCount: number;
    startingCash: number;
    expectedCash: number;
}

/**
 * Get whether the Shift feature is enabled in ShopInfo
 */
export async function getShiftConfig(): Promise<{ enabled: boolean }> {
    try {
        const shop = await prisma.shopInfo.findUnique({
            where: { id: 'shop-info' },
            select: { enableShift: true },
        });
        return { enabled: shop?.enableShift ?? false };
    } catch {
        return { enabled: false };
    }
}

/**
 * Update the Shift feature toggle in ShopInfo
 */
export async function updateShiftConfig(enabled: boolean) {
    await prisma.shopInfo.upsert({
        where: { id: 'shop-info' },
        update: { enableShift: enabled },
        create: { id: 'shop-info', enableShift: enabled },
    });
    revalidatePath('/pos');
    revalidatePath('/settings/shop-info');
    return { success: true, enabled };
}

/**
 * Get the current active (OPEN) shift for a specific user
 */
export async function getCurrentShift(userId: string) {
    if (!userId) return null;

    const shift = await prisma.cashierShift.findFirst({
        where: {
            userId,
            status: 'OPEN',
        },
        orderBy: { openedAt: 'desc' },
        include: {
            user: { select: { id: true, name: true, username: true } },
        },
    });

    if (!shift) return null;

    return {
        id: shift.id,
        shiftNumber: shift.shiftNumber,
        userId: shift.userId,
        userName: shift.user.name,
        status: shift.status,
        openedAt: shift.openedAt.toISOString(),
        startingCash: Number(shift.startingCash),
        notes: shift.notes,
    };
}

/**
 * Open a new shift for a user
 */
export async function openShift(data: {
    userId: string;
    startingCash: number;
    notes?: string;
}) {
    if (!data.userId) {
        throw new Error('ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
    }

    // Check if user already has an active OPEN shift
    const existing = await prisma.cashierShift.findFirst({
        where: {
            userId: data.userId,
            status: 'OPEN',
        },
    });

    if (existing) {
        throw new Error(`คุณมีกะ ${existing.shiftNumber} เปิดค้างอยู่แล้ว กรุณาปิดกะเดิมก่อน`);
    }

    const shiftNumber = await generateNumber('SH');

    const newShift = await prisma.cashierShift.create({
        data: {
            shiftNumber,
            userId: data.userId,
            status: 'OPEN',
            startingCash: data.startingCash || 0,
            notes: data.notes?.trim() || null,
        },
        include: {
            user: { select: { id: true, name: true, username: true } },
        },
    });

    revalidatePath('/pos');
    return {
        id: newShift.id,
        shiftNumber: newShift.shiftNumber,
        userId: newShift.userId,
        userName: newShift.user.name,
        status: newShift.status,
        openedAt: newShift.openedAt.toISOString(),
        startingCash: Number(newShift.startingCash),
        notes: newShift.notes,
    };
}

/**
 * Calculate live sales summary for a shift
 */
export async function getShiftSummary(shiftId: string): Promise<{
    shift: any;
    summary: ShiftSummaryData;
}> {
    const shift = await prisma.cashierShift.findUnique({
        where: { id: shiftId },
        include: {
            user: { select: { id: true, name: true, username: true } },
            sales: {
                where: {
                    status: 'APPROVED',
                    deletedAt: null,
                },
                select: {
                    id: true,
                    saleNumber: true,
                    totalAmount: true,
                    paymentMethod: true,
                    payments: true,
                    createdAt: true,
                },
            },
        },
    });

    if (!shift) {
        throw new Error('ไม่พบข้อมูลกะ');
    }

    let cashSales = 0;
    let transferSales = 0;
    let chequeSales = 0;
    let creditSales = 0;

    for (const sale of shift.sales) {
        const total = Number(sale.totalAmount);
        if (sale.payments && Array.isArray(sale.payments) && (sale.payments as any[]).length > 0) {
            for (const p of sale.payments as { method: string; amount: number }[]) {
                const amt = Number(p.amount) || 0;
                switch (p.method) {
                    case 'CASH':
                        cashSales += amt;
                        break;
                    case 'TRANSFER':
                        transferSales += amt;
                        break;
                    case 'CHEQUE':
                        chequeSales += amt;
                        break;
                    case 'CREDIT':
                        creditSales += amt;
                        break;
                    default:
                        cashSales += amt;
                        break;
                }
            }
        } else {
            switch (sale.paymentMethod) {
                case 'CASH':
                    cashSales += total;
                    break;
                case 'TRANSFER':
                    transferSales += total;
                    break;
                case 'CHEQUE':
                    chequeSales += total;
                    break;
                case 'CREDIT':
                    creditSales += total;
                    break;
                default:
                    cashSales += total;
                    break;
            }
        }
    }

    const startingCash = Number(shift.startingCash);
    const totalSales = cashSales + transferSales + chequeSales + creditSales;
    const expectedCash = startingCash + cashSales;

    return {
        shift: {
            id: shift.id,
            shiftNumber: shift.shiftNumber,
            userId: shift.userId,
            userName: shift.user.name,
            status: shift.status,
            openedAt: shift.openedAt.toISOString(),
            closedAt: shift.closedAt?.toISOString() || null,
            startingCash,
            closingCash: shift.closingCash != null ? Number(shift.closingCash) : null,
            expectedCash: shift.expectedCash != null ? Number(shift.expectedCash) : expectedCash,
            difference: shift.difference != null ? Number(shift.difference) : null,
            notes: shift.notes,
        },
        summary: {
            totalSales: Math.round(totalSales * 100) / 100,
            cashSales: Math.round(cashSales * 100) / 100,
            transferSales: Math.round(transferSales * 100) / 100,
            chequeSales: Math.round(chequeSales * 100) / 100,
            creditSales: Math.round(creditSales * 100) / 100,
            salesCount: shift.sales.length,
            startingCash,
            expectedCash: Math.round(expectedCash * 100) / 100,
        },
    };
}

/**
 * Close a shift and record final amounts
 */
export async function closeShift(data: {
    shiftId: string;
    closingCash?: number;
    notes?: string;
}) {
    const { shift, summary } = await getShiftSummary(data.shiftId);

    if (shift.status === 'CLOSED') {
        throw new Error('กะนี้ได้ถูกปิดไปแล้ว');
    }

    const expectedCash = summary.expectedCash;
    const closingCash = data.closingCash != null ? data.closingCash : expectedCash;
    const difference = Math.round((closingCash - expectedCash) * 100) / 100;

    const updated = await prisma.cashierShift.update({
        where: { id: data.shiftId },
        data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closingCash,
            expectedCash,
            difference,
            totalSales: summary.totalSales,
            cashSales: summary.cashSales,
            transferSales: summary.transferSales,
            chequeSales: summary.chequeSales,
            creditSales: summary.creditSales,
            salesCount: summary.salesCount,
            notes: data.notes?.trim() || shift.notes,
        },
        include: {
            user: { select: { id: true, name: true } },
        },
    });

    revalidatePath('/pos');
    revalidatePath('/shifts');

    return {
        id: updated.id,
        shiftNumber: updated.shiftNumber,
        userName: updated.user.name,
        status: updated.status,
        openedAt: updated.openedAt.toISOString(),
        closedAt: updated.closedAt?.toISOString() || null,
        startingCash: Number(updated.startingCash),
        closingCash: Number(updated.closingCash),
        expectedCash: Number(updated.expectedCash),
        difference: Number(updated.difference),
        totalSales: Number(updated.totalSales),
        cashSales: Number(updated.cashSales),
        transferSales: Number(updated.transferSales),
        chequeSales: Number(updated.chequeSales),
        creditSales: Number(updated.creditSales),
        salesCount: updated.salesCount,
        notes: updated.notes,
    };
}

/**
 * Get shift history for logs / admin view
 */
export async function getShiftHistory(params: {
    page?: number;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
}) {
    const page = params.page || 1;
    const pageSize = 15;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.userId) where.userId = params.userId;

    if (params.dateFrom || params.dateTo) {
        where.openedAt = {};
        if (params.dateFrom) where.openedAt.gte = new Date(params.dateFrom);
        if (params.dateTo) {
            const end = new Date(params.dateTo);
            end.setHours(23, 59, 59, 999);
            where.openedAt.lte = end;
        }
    }

    const [total, shifts] = await Promise.all([
        prisma.cashierShift.count({ where }),
        prisma.cashierShift.findMany({
            where,
            orderBy: { openedAt: 'desc' },
            skip,
            take: pageSize,
            include: {
                user: { select: { id: true, name: true, username: true } },
            },
        }),
    ]);

    return {
        shifts: shifts.map(s => ({
            id: s.id,
            shiftNumber: s.shiftNumber,
            userId: s.userId,
            userName: s.user.name,
            status: s.status,
            openedAt: s.openedAt.toISOString(),
            closedAt: s.closedAt?.toISOString() || null,
            startingCash: Number(s.startingCash),
            closingCash: s.closingCash != null ? Number(s.closingCash) : null,
            expectedCash: s.expectedCash != null ? Number(s.expectedCash) : null,
            difference: s.difference != null ? Number(s.difference) : null,
            totalSales: Number(s.totalSales),
            cashSales: Number(s.cashSales),
            transferSales: Number(s.transferSales),
            chequeSales: Number(s.chequeSales),
            creditSales: Number(s.creditSales),
            salesCount: s.salesCount,
            notes: s.notes,
        })),
        total,
        page,
        totalPages: Math.ceil(total / pageSize),
    };
}
