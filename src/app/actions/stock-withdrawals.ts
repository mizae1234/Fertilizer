'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/generateNumber';
import { roundQty } from '@/lib/utils';

export async function createStockWithdrawal(data: {
    requesterName: string;
    items: {
        productId: string;
        warehouseId: string;
        quantity: number;
        unitCost: number;
        notes?: string;
    }[];
    approverName?: string;
    packerName?: string;
    withdrawerName?: string;
    notes?: string;
    userId: string;
}) {
    if (!data.requesterName.trim()) throw new Error('กรุณาระบุชื่อผู้รับสินค้า');
    if (!data.items.length) throw new Error('กรุณาเพิ่มรายการสินค้า');
    if (!data.userId) throw new Error('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');

    const withdrawalNumber = await generateNumber('WD');

    const result = await prisma.$transaction(async (tx) => {
        // Fetch actual product costs from the database
        const productCosts = await Promise.all(
            data.items.map(async (item) => {
                const product = await tx.product.findUnique({
                    where: { id: item.productId },
                    select: { cost: true },
                });
                return product ? Number(product.cost) : 0;
            })
        );

        const totalAmount = Math.round(data.items.reduce((sum, item, idx) => {
            const cost = productCosts[idx];
            return sum + roundQty(item.quantity) * cost;
        }, 0) * 100) / 100;

        const withdrawal = await tx.stockWithdrawal.create({
            data: {
                withdrawalNumber,
                requesterName: data.requesterName.trim(),
                totalAmount,
                notes: data.notes || null,
                approverName: data.approverName || null,
                packerName: data.packerName || null,
                withdrawerName: data.withdrawerName || null,
                createdById: data.userId,
                items: {
                    create: data.items.map((item, idx) => {
                        const cost = productCosts[idx];
                        const qty = roundQty(item.quantity);
                        return {
                            productId: item.productId,
                            warehouseId: item.warehouseId,
                            quantity: qty,
                            unitCost: cost,
                            totalCost: Math.round(qty * cost * 100) / 100,
                            notes: item.notes?.trim() || null,
                        };
                    }),
                },
            },
        });

        // Deduct stock + create stock transactions
        await Promise.all(data.items.map(async (item, idx) => {
            const costToUse = productCosts[idx];
            const qty = roundQty(item.quantity);
            const destStock = await tx.productStock.findUnique({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                    },
                },
            });
            const currentAvgCost = destStock ? Number(destStock.avgCost) : 0;

            await tx.productStock.upsert({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                    },
                },
                update: { 
                    quantity: roundQty((destStock?.quantity ?? 0) - qty),
                    ...(currentAvgCost === 0 ? { avgCost: costToUse } : {})
                },
                create: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    quantity: -qty,
                    avgCost: costToUse,
                },
            });

            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    type: 'WITHDRAWAL',
                    quantity: -qty,
                    unitCost: costToUse,
                    reference: withdrawalNumber,
                    userId: data.userId,
                    notes: `เบิกสินค้า ${withdrawalNumber}${item.notes?.trim() ? ` (${item.notes.trim()})` : ''}`,
                },
            });
        }));

        return withdrawal;
    });

    revalidatePath('/stock-withdrawals');
    return { id: result.id, withdrawalNumber: result.withdrawalNumber };
}

export async function getStockWithdrawals(page = 1, from = '', to = '', search = '') {
    const perPage = 15;
    const where: Record<string, unknown> = { deletedAt: null };

    if (from || to) {
        where.createdAt = {};
        if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
        if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to + 'T23:59:59');
    }

    const trimmedSearch = search.trim();
    if (trimmedSearch) {
        const tokens = trimmedSearch.split(/\s+/).filter(Boolean);
        where.AND = tokens.map(token => ({
            OR: [
                { withdrawalNumber: { contains: token, mode: 'insensitive' } },
                { requesterName: { contains: token, mode: 'insensitive' } },
                { approverName: { contains: token, mode: 'insensitive' } },
                { packerName: { contains: token, mode: 'insensitive' } },
                { withdrawerName: { contains: token, mode: 'insensitive' } },
                { notes: { contains: token, mode: 'insensitive' } },
                { createdBy: { name: { contains: token, mode: 'insensitive' } } },
                {
                    items: {
                        some: {
                            OR: [
                                { notes: { contains: token, mode: 'insensitive' } },
                                {
                                    product: {
                                        OR: [
                                            { name: { contains: token, mode: 'insensitive' } },
                                            { code: { contains: token, mode: 'insensitive' } },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                },
            ],
        }));
    }

    const [records, total, totalCostAgg] = await Promise.all([
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
        prisma.stockWithdrawal.aggregate({
            where: { ...where, status: 'APPROVED' },
            _sum: { totalAmount: true },
        }),
    ]);

    return { 
        records: records.map(r => ({
            ...r,
            totalAmount: Number(r.totalAmount),
        })), 
        totalPages: Math.ceil(total / perPage), 
        total,
        totalCost: Number(totalCostAgg._sum.totalAmount || 0),
    };
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
            const qtyToRestore = roundQty(matchingTx ? Math.abs(matchingTx.quantity) : item.quantity);
            const curStock = await tx.productStock.findUnique({
                where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
            });

            await tx.productStock.update({
                where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
                data: { quantity: roundQty((curStock?.quantity ?? 0) + qtyToRestore) },
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
    revalidatePath('/reports');
}
