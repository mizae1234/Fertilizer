'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/generateNumber';

export async function createStockWithdrawal(data: {
    requesterName: string;
    items: {
        productId: string;
        warehouseId: string;
        quantity: number;
        unitCost: number;
    }[];
    approverName?: string;
    withdrawerName?: string;
    notes?: string;
    userId: string;
}) {
    if (!data.requesterName.trim()) throw new Error('กรุณาระบุชื่อผู้เบิกสินค้า');
    if (!data.items.length) throw new Error('กรุณาเพิ่มรายการสินค้า');
    if (!data.userId) throw new Error('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');

    const totalAmount = data.items.reduce((sum, item) => item.quantity * item.unitCost + sum, 0);
    const withdrawalNumber = await generateNumber('WD');

    const result = await prisma.$transaction(async (tx) => {
        const withdrawal = await tx.stockWithdrawal.create({
            data: {
                withdrawalNumber,
                requesterName: data.requesterName.trim(),
                totalAmount,
                notes: data.notes || null,
                approverName: data.approverName || null,
                withdrawerName: data.withdrawerName || null,
                createdById: data.userId,
                items: {
                    create: data.items.map(item => ({
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        quantity: item.quantity,
                        unitCost: item.unitCost,
                        totalCost: item.quantity * item.unitCost,
                    })),
                },
            },
        });

        // Deduct stock + create stock transactions
        await Promise.all(data.items.map(async (item) => {
            await tx.productStock.upsert({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                    },
                },
                update: { quantity: { decrement: item.quantity } },
                create: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    quantity: -item.quantity,
                },
            });

            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    type: 'WITHDRAWAL',
                    quantity: -item.quantity,
                    unitCost: item.unitCost,
                    reference: withdrawalNumber,
                    userId: data.userId,
                    notes: `เบิกสินค้า ${withdrawalNumber}`,
                },
            });
        }));

        return withdrawal;
    });

    revalidatePath('/stock-withdrawals');
    return { id: result.id, withdrawalNumber: result.withdrawalNumber };
}

export async function getStockWithdrawals(page = 1, from = '', to = '') {
    const perPage = 15;
    const where: Record<string, unknown> = { deletedAt: null };

    if (from || to) {
        where.createdAt = {};
        if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
        if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to + 'T23:59:59');
    }

    const [records, total] = await Promise.all([
        prisma.stockWithdrawal.findMany({
            where,
            include: {
                createdBy: { select: { name: true } },
                _count: { select: { items: true } },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.stockWithdrawal.count({ where }),
    ]);

    return { records, totalPages: Math.ceil(total / perPage), total };
}

export async function getStockWithdrawalDetail(id: string) {
    const record = await prisma.stockWithdrawal.findUnique({
        where: { id },
        include: {
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true } },
                    warehouse: { select: { name: true } },
                },
            },
        },
    });
    if (!record) throw new Error('ไม่พบรายการเบิกสินค้า');
    return record;
}

export async function cancelStockWithdrawal(id: string) {
    const wd = await prisma.stockWithdrawal.findUnique({
        where: { id },
        include: { items: true },
    });
    if (!wd) throw new Error('ไม่พบรายการเบิกสินค้า');
    if (wd.status === 'CANCELLED') throw new Error('รายการนี้ถูกยกเลิกแล้ว');

    await prisma.$transaction(async (tx) => {
        const originalTxs = await tx.stockTransaction.findMany({
            where: { reference: wd.withdrawalNumber, type: 'WITHDRAWAL' },
        });

        for (const item of wd.items) {
            const matchingTx = originalTxs.find(
                st => st.productId === item.productId && st.warehouseId === item.warehouseId
            );
            const qtyToRestore = matchingTx ? Math.abs(matchingTx.quantity) : item.quantity;

            await tx.productStock.update({
                where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
                data: { quantity: { increment: qtyToRestore } },
            });

            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    type: 'WITHDRAWAL',
                    quantity: qtyToRestore,
                    unitCost: item.unitCost,
                    reference: wd.withdrawalNumber,
                    userId: wd.createdById,
                    notes: `ยกเลิกเบิกสินค้า ${wd.withdrawalNumber}`,
                },
            });
        }

        await tx.stockWithdrawal.update({
            where: { id },
            data: { status: 'CANCELLED' },
        });
    });

    revalidatePath('/stock-withdrawals');
    revalidatePath(`/stock-withdrawals/${id}`);
}
