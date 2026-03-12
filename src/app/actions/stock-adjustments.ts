'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/generateNumber';

export async function getStockAdjustments(page = 1, search = '', from = '', to = '') {
    const perPage = 15;
    const where: Record<string, unknown> = {
        type: 'ADJUSTMENT',
    };

    if (search) {
        where.OR = [
            { reference: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
            { product: { name: { contains: search, mode: 'insensitive' } } },
        ];
    }

    if (from || to) {
        where.createdAt = {};
        if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
        if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to + 'T23:59:59');
    }

    const [records, total] = await Promise.all([
        prisma.stockTransaction.findMany({
            where,
            select: {
                id: true, quantity: true, unitCost: true, reference: true, notes: true, createdAt: true,
                product: { select: { name: true, code: true, unit: true } },
                warehouse: { select: { name: true } },
                user: { select: { name: true } },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.stockTransaction.count({ where }),
    ]);

    return { records, totalPages: Math.ceil(total / perPage), total };
}

export async function createStockAdjustment(data: {
    adjustmentType?: 'increase' | 'decrease';
    note?: string;
    items: {
        productId: string;
        warehouseId: string;
        quantity: number;
        reason: string;
    }[];
    userId: string;
}) {
    if (!data.adjustmentType) data.adjustmentType = 'decrease';
    if (!data.items.length) throw new Error('กรุณาเพิ่มรายการสินค้า');

    const adjNumber = await generateNumber('ADJ');

    await prisma.$transaction(async (tx) => {
        for (const item of data.items) {
            if (item.quantity <= 0) throw new Error('จำนวนต้องมากกว่า 0');

            const stock = await tx.productStock.findUnique({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                    },
                },
            });

            const noteText = [item.reason, data.note].filter(Boolean).join(' — ');

            if (data.adjustmentType === 'decrease') {
                // Decrease mode — deduct stock
                if (!stock || stock.quantity < item.quantity) {
                    const product = await tx.product.findUnique({ where: { id: item.productId }, select: { name: true } });
                    throw new Error(`สินค้า "${product?.name || item.productId}" มี stock ไม่พอ (คงเหลือ ${stock?.quantity || 0}, ต้องการตัด ${item.quantity})`);
                }

                await tx.productStock.update({
                    where: { id: stock.id },
                    data: { quantity: { decrement: item.quantity } },
                });

                const newBalance = stock.quantity - item.quantity;

                await tx.stockTransaction.create({
                    data: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        type: 'ADJUSTMENT',
                        quantity: -item.quantity,
                        unitCost: Number(stock.avgCost),
                        reference: adjNumber,
                        userId: data.userId,
                        balanceAfter: newBalance,
                        notes: noteText,
                    },
                });
            } else {
                // Increase mode — add stock
                if (stock) {
                    await tx.productStock.update({
                        where: { id: stock.id },
                        data: { quantity: { increment: item.quantity } },
                    });
                } else {
                    await tx.productStock.create({
                        data: {
                            productId: item.productId,
                            warehouseId: item.warehouseId,
                            quantity: item.quantity,
                        },
                    });
                }

                const newBalance = (stock?.quantity || 0) + item.quantity;

                await tx.stockTransaction.create({
                    data: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        type: 'ADJUSTMENT',
                        quantity: item.quantity,
                        unitCost: stock ? Number(stock.avgCost) : 0,
                        reference: adjNumber,
                        userId: data.userId,
                        balanceAfter: newBalance,
                        notes: noteText,
                    },
                });
            }
        }
    });

    revalidatePath('/stock-adjustments');
    revalidatePath('/products');
    revalidatePath('/warehouses');
    return { adjNumber };
}
